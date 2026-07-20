import { NextResponse } from "next/server";
import { createLoginToken } from "@/lib/login-token";
import { setLoginRequestCookie } from "@/lib/session";

export async function GET() {
  const login = await createLoginToken();
  await setLoginRequestCookie(login.token);
  return NextResponse.redirect(login.botUrl, 302);
}
