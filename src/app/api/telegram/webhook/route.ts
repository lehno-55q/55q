import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { confirmLoginToken, parseAuthPayload } from "@/lib/login-token";
import { botStartLink, inviteLink, sendTelegramMessage } from "@/lib/telegram";

function timingSafeEqualText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function extractStartPayload(text: string, botUsername?: string) {
  const parts = text.trim().split(/\s+/);
  const command = parts[0] || "";
  if (!command.startsWith("/start")) return null;
  if (command.includes("@") && botUsername) {
    const target = command.split("@")[1]?.toLowerCase();
    if (target !== botUsername.toLowerCase()) return null;
  }
  return parts.slice(1).join(" ");
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret) {
    const received = request.headers.get("x-telegram-bot-api-secret-token") || "";
    if (!timingSafeEqualText(received, webhookSecret)) {
      console.warn("[telegram_auth] webhook_secret_mismatch", { hasReceivedSecret: Boolean(received) });
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const update = await request.json();
  const message = update.message;
  const chatId = message?.chat?.id;
  const text = message?.text || "";
  const payload = extractStartPayload(text, process.env.TELEGRAM_BOT_USERNAME || "ai_55q_bot");
  console.info("[telegram_auth] webhook_received", {
    updateId: update.update_id,
    hasChatId: Boolean(chatId),
    command: text.split(/\s+/)[0] || "",
    hasPayload: Boolean(payload),
  });

  if (!chatId || payload === null) return NextResponse.json({ ok: true });

  const authToken = parseAuthPayload(payload);
  if (authToken) {
    const confirmed = await confirmLoginToken({
      startPayload: `auth_${authToken}`,
      telegramId: String(message.from?.id || chatId),
      telegramName: message.from?.username,
      firstName: message.from?.first_name,
    });

    await sendTelegramMessage(
      String(chatId),
      confirmed
        ? "<b>✅ Авторизация выполнена успешно</b>\nОткройте приложение 55 Вопросов внутри Telegram."
        : "<b>⚠️ Ссылка для входа не сработала</b>\nОна истекла или уже была использована. Попробуйте войти ещё раз.",
    );
    return NextResponse.json({ ok: true });
  }

  if (!payload) {
    await sendTelegramMessage(
      String(chatId),
      "<b>👋 Я на связи</b>\n55 Вопросов сейчас работает только как Telegram Mini App. Откройте приложение через кнопку меню бота.",
    );
    return NextResponse.json({ ok: true });
  }

  const link = payload ? inviteLink(payload) : botStartLink();
  await sendTelegramMessage(String(chatId), `Добро пожаловать в 55 Вопросов. Откройте приложение: ${link}`);
  return NextResponse.json({ ok: true });
}
