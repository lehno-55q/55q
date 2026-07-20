import crypto from "crypto";
import { appUrl, botUsername } from "./env";

type TelegramAuthPayload = {
  id: number | string;
  first_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: number | string;
  hash?: string;
};

export type TelegramMiniAppUser = {
  id: number | string;
  first_name?: string;
  username?: string;
};

export function verifyTelegramLogin(payload: TelegramAuthPayload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !payload.hash) return false;

  const { hash, ...data } = payload;
  const checkString = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = crypto.createHash("sha256").update(token).digest();
  const expected = crypto.createHmac("sha256", secret).update(checkString).digest("hex");

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
}

export function verifyMiniAppInitData(initData: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date") || 0);
  params.delete("hash");
  if (!hash) return null;
  if (!authDate || Date.now() / 1000 - authDate > 60 * 60 * 24) return null;

  const checkString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const expected = crypto.createHmac("sha256", secret).update(checkString).digest("hex");
  if (expected.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash))) return null;

  const user = params.get("user");
  if (!user) return null;
  const parsed = JSON.parse(user) as TelegramMiniAppUser;
  if (!parsed.id) return null;
  return parsed;
}

export function loginWidgetUrl() {
  const origin = encodeURIComponent(`${appUrl}/api/auth/telegram`);
  return `https://oauth.telegram.org/auth?bot_id=${botUsername}&origin=${origin}&request_access=write`;
}

export async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!response.ok) {
    console.warn("[telegram_auth] send_message_failed", { status: response.status, body: await response.text() });
  }
}

export function inviteLink(code: string) {
  return `${appUrl}/?invite=${code}`;
}

export function botStartLink(code?: string) {
  return `https://t.me/${botUsername}${code ? `?start=${code}` : ""}`;
}
