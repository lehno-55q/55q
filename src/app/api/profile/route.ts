import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveProfile } from "@/lib/domain";
import { requireUserId } from "@/lib/session";

const schema = z.object({
  displayName: z.string().min(2).max(40),
  gender: z.enum(["male", "female"]),
});

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  const body = schema.parse(await request.json());
  return NextResponse.json(await saveProfile(userId, body.displayName, body.gender));
}
