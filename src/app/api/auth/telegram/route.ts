import { NextRequest, NextResponse } from "next/server";
import { upsertTelegramUser } from "@/lib/domain";
import { setUserSession } from "@/lib/session";
import { verifyMiniAppInitData } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const miniUser = body.initData ? verifyMiniAppInitData(body.initData) : null;

  if (!miniUser) {
    return NextResponse.json({ ok: false, error: "Telegram Mini App auth failed" }, { status: 401 });
  }

  const user = await upsertTelegramUser({
    telegramId: String(miniUser.id),
    telegramName: miniUser.username,
    firstName: miniUser.first_name,
    photoUrl: miniUser.photo_url,
  });
  await setUserSession(user.id);
  return NextResponse.json({ ok: true, user });
}
