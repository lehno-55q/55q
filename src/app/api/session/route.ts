import { NextResponse } from "next/server";
import { ensureSession, getUserState } from "@/lib/domain";
import { requireUserId } from "@/lib/session";

export async function POST() {
  const userId = await requireUserId();
  const state = await getUserState(userId);
  if (!state?.pair) return NextResponse.json({ error: "Pair required" }, { status: 409 });
  return NextResponse.json(await ensureSession(state.pair.id));
}
