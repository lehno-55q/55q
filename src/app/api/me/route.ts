import { NextResponse } from "next/server";
import { getUserState } from "@/lib/domain";
import { currentUserId } from "@/lib/session";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ user: null });
  return NextResponse.json(await getUserState(userId));
}
