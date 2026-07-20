import { NextRequest, NextResponse } from "next/server";
import { confirmLoginToken } from "@/lib/login-token";
import { botStartLink, inviteLink, sendTelegramMessage } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  const update = await request.json();
  const message = update.message;
  const chatId = message?.chat?.id;
  const text = message?.text || "";

  if (chatId && text.startsWith("/start")) {
    const payload = text.split(" ")[1];
    const confirmed = payload
      ? await confirmLoginToken({
          startPayload: payload,
          telegramId: String(message.from?.id || chatId),
          telegramName: message.from?.username,
          firstName: message.from?.first_name,
        })
      : null;

    if (confirmed) {
      await sendTelegramMessage(String(chatId), "Вход подтвержден. Вернитесь на сайт 55Q.");
    } else {
      const link = payload ? inviteLink(payload) : botStartLink();
      await sendTelegramMessage(String(chatId), `Добро пожаловать в 55Q. Откройте приложение: ${link}`);
    }
  }

  return NextResponse.json({ ok: true });
}
