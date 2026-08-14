import { NextResponse } from "next/server";
import { clearGoogleTokens } from "@/lib/auth";

export async function POST() {
  await clearGoogleTokens();
  return NextResponse.json({ ok: true });
}
