import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { unlockReport } from "@/lib/domain";
import { requireUserId } from "@/lib/session";

const schema = z.object({ sessionId: z.string() });

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  const body = schema.parse(await request.json());
  return NextResponse.json(await unlockReport(body.sessionId, userId));
}
