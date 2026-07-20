import { NextRequest, NextResponse } from "next/server";
import { botStartLink, inviteLink, sendTelegramMessage } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  const update = await request.json();
  const message = update.message;
  const chatId = message?.chat?.id;
  const text = message?.text || "";

  if (chatId && text.startsWith("/start")) {
    const code = text.split(" ")[1];
    const link = code ? inviteLink(code) : botStartLink();
    await sendTelegramMessage(String(chatId), `Добро пожаловать в 55Q. Откройте приложение: ${link}`);
  }

  return NextResponse.json({ ok: true });
}
