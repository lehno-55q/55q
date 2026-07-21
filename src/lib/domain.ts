import { prisma } from "./db";
import { makeInviteCode, normalizeInviteCode } from "./invite";
import { generateDeepSeekReport } from "./report";
import { questions } from "./tests";
import { inviteLink, sendTelegramMessage } from "./telegram";

export async function getUserState(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      pairMembership: { include: { pair: { include: { members: { include: { user: true } } } } } },
    },
  });
  if (!user) return null;

  const pair = user.pairMembership?.pair || null;
  const session = pair
    ? await prisma.testSession.findFirst({
        where: { pairId: pair.id, testSlug: "couple-truth" },
        orderBy: { createdAt: "desc" },
        include: { answers: true, payments: true },
      })
    : null;

  return { user, pair, session, questionsTotal: questions.length };
}

export async function upsertTelegramUser(input: {
  telegramId: string;
  telegramName?: string;
  firstName?: string;
  photoUrl?: string;
}) {
  return prisma.user.upsert({
    where: { telegramId: input.telegramId },
    create: input,
    update: { telegramName: input.telegramName, firstName: input.firstName, photoUrl: input.photoUrl },
  });
}

export async function saveProfile(userId: string, displayName: string, gender: string, birthDate: Date, age: number) {
  return prisma.user.update({
    where: { id: userId },
    data: { displayName, gender, birthDate, age },
  });
}

export async function createPair(userId: string, name: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = makeInviteCode();
    try {
      const pair = await prisma.pair.create({
        data: {
          name,
          inviteCode,
          createdById: userId,
          members: { create: { userId } },
        },
      });
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.telegramId) {
        await sendTelegramMessage(
          user.telegramId,
          `Пара <b>${name}</b> создана. Пригласите партнера: ${inviteLink(inviteCode)}`,
        );
      }
      return pair;
    } catch {
      continue;
    }
  }
  throw new Error("Не удалось создать invite code");
}

export async function joinPair(userId: string, rawCode: string) {
  const inviteCode = normalizeInviteCode(rawCode);
  const pair = await prisma.pair.findUnique({ where: { inviteCode }, include: { members: true } });
  if (!pair) throw new Error("Пара с таким кодом не найдена");
  if (pair.members.some((member) => member.userId === userId)) return pair;
  if (pair.members.length >= 2) throw new Error("В этой паре уже два участника");

  await prisma.pairMember.create({ data: { pairId: pair.id, userId } });
  await notifyPair(pair.id, `🎉 <b>Поздравляем, пара подтверждена!</b>\nВам доступен весь функционал бота.`);
  return pair;
}

export async function ensureSession(pairId: string) {
  return prisma.testSession.upsert({
    where: { id: `${pairId}:couple-truth` },
    create: { id: `${pairId}:couple-truth`, pairId, testSlug: "couple-truth" },
    update: {},
  });
}

export async function saveAnswer(sessionId: string, userId: string, question: number, value: unknown) {
  await prisma.answer.upsert({
    where: { sessionId_userId_question: { sessionId, userId, question } },
    create: { sessionId, userId, question, value: value as object },
    update: { value: value as object },
  });
  return maybeCompleteSession(sessionId);
}

async function maybeCompleteSession(sessionId: string) {
  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    include: { pair: { include: { members: true } }, answers: true },
  });
  if (!session || session.pair.members.length < 2) return session;

  const completeUsers = session.pair.members.filter((member) => {
    const count = session.answers.filter((answer) => answer.userId === member.userId).length;
    return count >= questions.length;
  });
  if (completeUsers.length < 2) return session;

  const report = await generateDeepSeekReport(session.answers);
  const updated = await prisma.testSession.update({
    where: { id: sessionId },
    data: { status: "REPORT_READY", freeReport: report as object, fullReport: report as object },
  });
  await notifyPair(session.pairId, "Оба участника завершили 55 Вопросов. Краткий результат уже открыт.");
  return updated;
}

export async function unlockReport(sessionId: string, userId: string) {
  await prisma.payment.create({
    data: { sessionId, userId, amountRub: Number(process.env.REPORT_PRICE_RUB || 149), status: "PAID", paidAt: new Date() },
  });
  return prisma.testSession.update({ where: { id: sessionId }, data: { fullUnlocked: true } });
}

async function notifyPair(pairId: string, text: string) {
  const pair = await prisma.pair.findUnique({ where: { id: pairId }, include: { members: { include: { user: true } } } });
  await Promise.all((pair?.members || []).map((member) => sendTelegramMessage(member.user.telegramId, text)));
}
