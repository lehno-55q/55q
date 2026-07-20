const token = process.env.TELEGRAM_BOT_TOKEN;
const username = process.env.TELEGRAM_BOT_USERNAME || "ai_55q_bot";
const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.TELEGRAM_WEBAPP_URL;
const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");
if (!appUrl) throw new Error("APP_URL or NEXT_PUBLIC_APP_URL is required");

const api = `https://api.telegram.org/bot${token}`;

async function call(method, body) {
  const response = await fetch(`${api}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`${method} failed: ${JSON.stringify(data)}`);
  return data.result;
}

const me = await call("getMe", {});
if (me.username?.toLowerCase() !== username.toLowerCase()) {
  throw new Error(`Bot username mismatch: expected ${username}, got ${me.username}`);
}

await call("setWebhook", {
  url: `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`,
  secret_token: secretToken || undefined,
  allowed_updates: ["message"],
});

await call("setChatMenuButton", {
  menu_button: {
    type: "web_app",
    text: "Открыть 55Q",
    web_app: { url: appUrl },
  },
});

const info = await call("getWebhookInfo", {});
console.log(JSON.stringify({ bot: me.username, webhook: info.url, menuButton: appUrl }, null, 2));
