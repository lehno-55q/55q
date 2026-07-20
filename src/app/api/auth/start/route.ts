import { NextResponse } from "next/server";
import { createLoginToken } from "@/lib/login-token";
import { setLoginRequestCookie } from "@/lib/session";

export async function POST() {
  const login = await createLoginToken();
  await setLoginRequestCookie(login.token);
  return NextResponse.json({ botUrl: login.botUrl, tgUrl: login.tgUrl, expiresAt: login.expiresAt });
}
