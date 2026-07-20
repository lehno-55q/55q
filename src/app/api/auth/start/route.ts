import { NextResponse } from "next/server";
import { createLoginToken } from "@/lib/login-token";

export async function POST() {
  return NextResponse.json(await createLoginToken());
}
