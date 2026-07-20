# 55Q

MVP сайта и Telegram-бота для совместного теста отношений: профиль, пара по invite-коду, 55 вопросов, скрытые ответы, краткий DeepSeek-результат и разблокировка полного отчета за 149 RUB.

## Stack

- Next.js App Router
- Prisma + PostgreSQL
- Telegram webhook
- DeepSeek Chat Completions API
- Railway-ready deploy config

## Environment

Copy `.env.example` to `.env` locally or set the same variables in Railway:

```bash
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_APP_URL="https://your-app.up.railway.app"
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_BOT_USERNAME="ai_55q_bot"
DEEPSEEK_API_KEY="..."
DEEPSEEK_MODEL="deepseek-chat"
REPORT_PRICE_RUB="149"
```

`DEEPSEEK_API_KEY` is optional for first deploy. Without it the app returns a deterministic demo report.

## Run

```bash
npm install
npm run migrate:deploy
npm run dev
```

For Railway the start command is already in `railway.json`:

```bash
npm run deploy:start
```

`deploy:start` runs `prisma migrate deploy` first, so every unapplied migration is applied before the Next.js server starts.

## Telegram webhook

After Railway deploy, set the webhook:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=$NEXT_PUBLIC_APP_URL/api/telegram/webhook"
```

Bot: `@ai_55q_bot`.

## Auth flow

- Telegram Mini App sends `Telegram.WebApp.initData` to `/api/auth/telegram`; the server validates the signature and creates an HttpOnly session cookie.
- A normal browser calls `/api/auth/start`, opens `https://t.me/ai_55q_bot?start=login_<token>`, waits on `/api/auth/status`, and receives the same HttpOnly session cookie after the bot webhook confirms the token.
- The raw browser login token is one-time and stored in the database only as a SHA-256 hash.

## Current MVP

- One active test: `Ваша пара`, 55 questions.
- Two placeholder tests: `Совместимость`, `HOT 18+`.
- Pair invite code: 6 uppercase latin letters/digits.
- Answers are not shown to the partner before both finish.
- Payment is a mock endpoint for now: `/api/payment/mock`.
