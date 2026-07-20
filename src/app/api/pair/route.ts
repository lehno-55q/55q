import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPair, joinPair } from "@/lib/domain";
import { requireUserId } from "@/lib/session";

const createSchema = z.object({ name: z.string().min(2).max(40) });
const joinSchema = z.object({ inviteCode: z.string().min(6).max(12) });

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  const body = await request.json();
  if (body.mode === "join") {
    return NextResponse.json(await joinPair(userId, joinSchema.parse(body).inviteCode));
  }
  return NextResponse.json(await createPair(userId, createSchema.parse(body).name));
}
