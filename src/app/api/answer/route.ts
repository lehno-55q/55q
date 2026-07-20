import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveAnswer } from "@/lib/domain";
import { requireUserId } from "@/lib/session";

const schema = z.object({
  sessionId: z.string(),
  question: z.number().int().min(1).max(55),
  value: z.unknown(),
});

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  const body = schema.parse(await request.json());
  return NextResponse.json(await saveAnswer(body.sessionId, userId, body.question, body.value));
}
