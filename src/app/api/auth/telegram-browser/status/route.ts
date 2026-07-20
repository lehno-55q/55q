import { NextResponse } from "next/server";
import { consumeConfirmedLoginToken, getLoginTokenStatus } from "@/lib/login-token";
import { clearLoginRequestCookie, getLoginRequestToken, setUserSession } from "@/lib/session";

export async function GET() {
  const token = await getLoginRequestToken();
  const status = await getLoginTokenStatus(token);

  if (status.status !== "confirmed" || !token) {
    if (status.status === "expired") await clearLoginRequestCookie();
    return NextResponse.json(status);
  }

  const userId = await consumeConfirmedLoginToken(token);
  if (!userId) {
    await clearLoginRequestCookie();
    return NextResponse.json({ status: "expired" });
  }

  await setUserSession(userId);
  await clearLoginRequestCookie();
  return NextResponse.json({ status: "confirmed", user: status.user });
}
