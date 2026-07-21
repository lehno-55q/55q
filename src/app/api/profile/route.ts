import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveProfile } from "@/lib/domain";
import { requireUserId } from "@/lib/session";

const schema = z.object({
  displayName: z.string().min(2).max(40),
  gender: z.enum(["male", "female"]),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function ageFromBirthDate(value: string) {
  const birthDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(birthDate.getTime()) || birthDate.toISOString().slice(0, 10) !== value) {
    return null;
  }
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }
  return { age, birthDate };
}

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  const body = schema.parse(await request.json());
  const parsed = ageFromBirthDate(body.birthDate);
  if (!parsed) {
    return NextResponse.json({ error: "Укажите корректную дату рождения" }, { status: 400 });
  }
  const { age, birthDate } = parsed;
  if (age < 14 || age > 80) {
    return NextResponse.json({ error: "Возраст должен быть от 14 до 80 лет" }, { status: 400 });
  }
  return NextResponse.json(await saveProfile(userId, body.displayName, body.gender, birthDate, age));
}
