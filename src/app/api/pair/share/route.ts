import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { botStartLink, sendTelegramMessage } from "@/lib/telegram";

function formatInviteCode(code: string) {
  const clean = code.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 6);
  return clean.length > 3 ? `${clean.slice(0, 3)} - ${clean.slice(3)}` : clean;
}

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
    `Пара <b>${pair.name}</b> создана.\nПерешли это сообщение своему партнёру.\n\nСсылка для приглашения: ${link}\nИнвайт-код: <code>${formatInviteCode(pair.inviteCode)}</code>`,
  );

  return NextResponse.json({ ok: true });
}
