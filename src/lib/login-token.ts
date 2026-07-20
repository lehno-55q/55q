import crypto from "crypto";
import { prisma } from "./db";
import { botUsername } from "./env";
import { upsertTelegramUser } from "./domain";

const tokenPrefix = "auth_";
const rawTokenPattern = /^[A-Za-z0-9_-]{43}$/;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
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

  return {
    token,
    expiresAt,
    botUrl: `https://t.me/${botUsername}?start=${tokenPrefix}${token}`,
  };
}

export function parseAuthPayload(text: string) {
  const payload = text.trim().split(/\s+/).find((part) => part.startsWith(tokenPrefix));
  if (!payload) return null;
  const token = payload.slice(tokenPrefix.length);
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
  const loginToken = await prisma.loginToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!loginToken || loginToken.consumedAt || loginToken.expiresAt < new Date()) return null;

  const user = await upsertTelegramUser({
    telegramId: input.telegramId,
    telegramName: input.telegramName,
    firstName: input.firstName,
  });

  if (!loginToken.userId) {
    await prisma.loginToken.update({
      where: { id: loginToken.id },
      data: { userId: user.id, confirmedAt: new Date() },
    });
  }

  return user;
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
    return { status: "confirmed" as const, user: loginToken.user };
  }
  return { status: "pending" as const, expiresAt: loginToken.expiresAt };
}
