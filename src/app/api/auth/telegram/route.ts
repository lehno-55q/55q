import { NextRequest, NextResponse } from "next/server";
import { upsertTelegramUser } from "@/lib/domain";
import { setUserSession } from "@/lib/session";
import { verifyMiniAppInitData, verifyTelegramLogin } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const miniUser = body.initData ? verifyMiniAppInitData(body.initData) : null;
  const loginUser = body.telegramUser && verifyTelegramLogin(body.telegramUser) ? body.telegramUser : null;
  const payload = miniUser || loginUser;

  if (!payload) {
    return NextResponse.json({ ok: false, error: "Telegram auth failed" }, { status: 401 });
  }

  const user = await upsertTelegramUser({
    telegramId: String(payload.id),
    telegramName: payload.username,
    firstName: payload.first_name,
  });
  await setUserSession(user.id);
  return NextResponse.json({ ok: true, user });
}

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  if (!verifyTelegramLogin(params as never)) {
    return NextResponse.redirect(new URL("/?auth=failed", request.url));
  }
  const user = await upsertTelegramUser({
    telegramId: String(params.id),
    telegramName: params.username,
    firstName: params.first_name,
  });
  await setUserSession(user.id);
  return NextResponse.redirect(new URL("/", request.url));
}
