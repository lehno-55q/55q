import crypto from "crypto";
import { prisma } from "./db";
import { botUsername } from "./env";

const tokenPrefix = "auth_";
const legacyTokenPrefix = "login_";
const rawTokenPattern = /^[A-Za-z0-9_-]{43}$/;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function tokenLogId(token: string | null) {
  if (!token) return "none";
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 12);
}

function authLog(event: string, data: Record<string, unknown> = {}) {
  console.info(`[telegram_auth] ${event}`, data);
}

export async function createLoginToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.loginToken.create({
    data: {
      tokenHash: hashToken(token),
      expiresAt,
    },
  });
  authLog("challenge_created", { tokenId: tokenLogId(token), expiresAt: expiresAt.toISOString() });

  return {
    token,
    expiresAt,
    botUrl: `https://t.me/${botUsername}?start=${tokenPrefix}${token}`,
    tgUrl: `tg://resolve?domain=${botUsername}&start=${tokenPrefix}${token}`,
  };
}

export function parseAuthPayload(text: string) {
  const payload = text.trim().split(/\s+/).find((part) => part.startsWith(tokenPrefix) || part.startsWith(legacyTokenPrefix));
  if (!payload) return null;
  const token = payload.startsWith(tokenPrefix) ? payload.slice(tokenPrefix.length) : payload.slice(legacyTokenPrefix.length);
  return rawTokenPattern.test(token) ? token : null;
}

export async function confirmLoginToken(input: {
  startPayload: string;
  telegramId: string;
  telegramName?: string;
  firstName?: string;
}) {
  const token = parseAuthPayload(input.startPayload);
  if (!token) return null;
  const tokenHash = hashToken(token);

  const confirmed = await prisma.$transaction(async (tx) => {
    const loginToken = await tx.loginToken.findUnique({
      where: { tokenHash },
    });
    if (!loginToken || loginToken.consumedAt || loginToken.expiresAt < new Date()) return null;
    authLog("token_found", { tokenId: tokenLogId(token) });

    if (loginToken.userId) {
      return tx.user.findUnique({ where: { id: loginToken.userId } });
    }

    const user = await tx.user.upsert({
      where: { telegramId: input.telegramId },
      create: {
        telegramId: input.telegramId,
        telegramName: input.telegramName,
        firstName: input.firstName,
      },
      update: { telegramName: input.telegramName, firstName: input.firstName },
    });

    if (!loginToken.userId) {
      await tx.loginToken.update({
        where: { id: loginToken.id },
        data: { userId: user.id, confirmedAt: new Date() },
      });
    }

    return user;
  });

  if (confirmed) authLog("token_confirmed", { tokenId: tokenLogId(token), telegramId: input.telegramId });

  return confirmed;
}

export async function consumeConfirmedLoginToken(token: string) {
  const loginToken = await prisma.loginToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!loginToken || !loginToken.userId || loginToken.consumedAt || loginToken.expiresAt < new Date()) {
    return null;
  }

  await prisma.loginToken.update({
    where: { id: loginToken.id },
    data: { consumedAt: new Date() },
  });
  authLog("session_created", { tokenId: tokenLogId(token), userId: loginToken.userId });

  return loginToken.userId;
}

export async function getLoginTokenStatus(token: string | null) {
  if (!token) return { status: "idle" as const };
  if (!rawTokenPattern.test(token)) return { status: "expired" as const };

  const loginToken = await prisma.loginToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!loginToken || loginToken.expiresAt < new Date() || loginToken.consumedAt) {
    return { status: "expired" as const };
  }
  if (loginToken.userId && loginToken.user) {
    authLog("status_confirmed", { tokenId: tokenLogId(token), userId: loginToken.userId });
    return { status: "confirmed" as const, user: loginToken.user };
  }
  return { status: "pending" as const, expiresAt: loginToken.expiresAt };
}
