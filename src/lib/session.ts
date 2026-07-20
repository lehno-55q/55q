import { cookies } from "next/headers";

const cookieName = "55q_user";
export const loginRequestCookieName = "55q_login";

export async function currentUserId() {
  const jar = await cookies();
  return jar.get(cookieName)?.value || null;
}

export async function setUserSession(userId: string) {
  const jar = await cookies();
  jar.set(cookieName, userId, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function setLoginRequestCookie(token: string) {
  const jar = await cookies();
  jar.set(loginRequestCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function getLoginRequestToken() {
  const jar = await cookies();
  return jar.get(loginRequestCookieName)?.value || null;
}

export async function clearLoginRequestCookie() {
  const jar = await cookies();
  jar.delete(loginRequestCookieName);
}

export async function requireUserId() {
  const userId = await currentUserId();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}
