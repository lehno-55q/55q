import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumeConfirmedLoginToken } from "@/lib/login-token";
import { setUserSession } from "@/lib/session";

const schema = z.object({ token: z.string().min(20) });

export async function POST(request: NextRequest) {
  const { token } = schema.parse(await request.json());
  const userId = await consumeConfirmedLoginToken(token);

  if (!userId) {
    return NextResponse.json({ ok: false, status: "pending" });
  }

  await setUserSession(userId);
  return NextResponse.json({ ok: true, status: "confirmed" });
}
