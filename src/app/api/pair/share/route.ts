import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { botStartLink, sendTelegramMessage } from "@/lib/telegram";

export async function POST() {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { pairMembership: { include: { pair: true } } },
  });
  const pair = user?.pairMembership?.pair;
  if (!user?.telegramId || !pair) {
    return NextResponse.json({ error: "Пара не найдена" }, { status: 404 });
  }

  const link = botStartLink(pair.inviteCode);
  await sendTelegramMessage(
    user.telegramId,
    [
      "💌 <b>На связи 55 Вопросов</b>",
      "",
      `Пара <b>${pair.name}</b> создана.`,
      "Перешли это сообщение партнёру, чтобы он мог подключиться к вашей паре.",
      "",
      `🔗 <b>Ссылка на инвайт:</b> ${link}`,
      `🔑 <b>Инвайт-код:</b> <code>${pair.inviteCode}</code>`,
    ].join("\n"),
  );

  return NextResponse.json({ ok: true });
}
