import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { upsertTelegramUser } from "@/lib/domain";
import { normalizeInviteCode } from "@/lib/invite";
import { confirmLoginToken, parseAuthPayload } from "@/lib/login-token";
import { botStartLink, sendTelegramMessage } from "@/lib/telegram";

function timingSafeEqualText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function commandTargetMatches(command: string, botUsername?: string) {
  const [, target] = command.split("@");
  return !target || !botUsername || target.toLowerCase() === botUsername.toLowerCase();
}

function isCommand(text: string, commandName: string, botUsername?: string) {
  const command = text.trim().split(/\s+/)[0] || "";
  const [name] = command.split("@");
  return name === `/${commandName}` && commandTargetMatches(command, botUsername);
}

function extractStartPayload(text: string, botUsername?: string) {
  const parts = text.trim().split(/\s+/);
  const command = parts[0] || "";
  if (!command.startsWith("/start")) return null;
  if (!commandTargetMatches(command, botUsername)) return null;
  return parts.slice(1).join(" ");
}

async function resetAllUserData() {
  await prisma.$transaction([
    prisma.payment.deleteMany(),
    prisma.answer.deleteMany(),
    prisma.testSession.deleteMany(),
    prisma.pairMember.deleteMany(),
    prisma.pair.deleteMany(),
    prisma.loginToken.deleteMany(),
    prisma.user.deleteMany(),
  ]);
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
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "ai_55q_bot";

  console.info("[telegram_auth] webhook_received", {
    updateId: update.update_id,
    hasChatId: Boolean(chatId),
    command: text.split(/\s+/)[0] || "",
  });

  if (!chatId) return NextResponse.json({ ok: true });

  if (isCommand(text, "reset", botUsername)) {
    const username = String(message.from?.username || "").toLowerCase();
    if (username !== "lehnovi4") {
      await sendTelegramMessage(String(chatId), "<b>⛔ Команда недоступна</b>");
      return NextResponse.json({ ok: true });
    }

    await resetAllUserData();
    console.warn("[telegram_admin] reset_completed", { by: username, chatId: String(chatId) });
    await sendTelegramMessage(String(chatId), "<b>✅ Данные очищены</b>\nУдалены пользователи, пары, ответы, тесты, платежи и временные токены входа.");
    return NextResponse.json({ ok: true });
  }

  const payload = extractStartPayload(text, botUsername);
  if (payload === null) return NextResponse.json({ ok: true });

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

  const inviteCode = normalizeInviteCode(payload);
  const pair = inviteCode ? await prisma.pair.findUnique({ where: { inviteCode } }) : null;
  if (pair) {
    await upsertTelegramUser({
      telegramId: String(message.from?.id || chatId),
      telegramName: message.from?.username,
      firstName: message.from?.first_name,
      pendingInviteCode: inviteCode,
    });
    await sendTelegramMessage(
      String(chatId),
      `✅ Инвайт-код <code>${inviteCode}</code> сохранён.\nОткройте приложение 55 Вопросов, создайте профиль и подтвердите присоединение к паре <b>${pair.name}</b>.`,
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

  await sendTelegramMessage(String(chatId), `Добро пожаловать в 55 Вопросов. Откройте приложение: ${botStartLink()}`);
  return NextResponse.json({ ok: true });
}
