import { NextResponse } from "next/server";
import { ensureDevUser } from "@/lib/session";

export async function POST() {
  const user = await ensureDevUser();
  return NextResponse.json({ ok: true, user });
}
