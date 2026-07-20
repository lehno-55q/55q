import { cookies } from "next/headers";
import { devAuthEnabled } from "./env";
import { upsertTelegramUser } from "./domain";

const cookieName = "55q_user";

export async function currentUserId() {
  const jar = await cookies();
  return jar.get(cookieName)?.value || null;
}

export async function setUserSession(userId: string) {
  const jar = await cookies();
  jar.set(cookieName, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function requireUserId() {
  const userId = await currentUserId();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export async function ensureDevUser() {
  if (!devAuthEnabled) throw new Error("Dev auth disabled");
  const user = await upsertTelegramUser({
    telegramId: `dev-${Date.now()}`,
    telegramName: "dev_user",
    firstName: "Demo",
  });
  await setUserSession(user.id);
  return user;
}
