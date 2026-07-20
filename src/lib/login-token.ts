import crypto from "crypto";
import { prisma } from "./db";
import { botUsername } from "./env";
import { upsertTelegramUser } from "./domain";

const tokenPrefix = "login_";

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

export async function confirmLoginToken(input: {
  startPayload: string;
  telegramId: string;
  telegramName?: string;
  firstName?: string;
}) {
  if (!input.startPayload.startsWith(tokenPrefix)) return null;

  const token = input.startPayload.slice(tokenPrefix.length);
  const loginToken = await prisma.loginToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!loginToken || loginToken.consumedAt || loginToken.expiresAt < new Date()) return null;

  const user = await upsertTelegramUser({
    telegramId: input.telegramId,
    telegramName: input.telegramName,
    firstName: input.firstName,
  });

  await prisma.loginToken.update({
    where: { id: loginToken.id },
    data: { userId: user.id, confirmedAt: new Date() },
  });

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
