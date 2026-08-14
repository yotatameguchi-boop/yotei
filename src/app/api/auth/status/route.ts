import { NextResponse } from "next/server";
import { getGoogleTokens, googleConfigured } from "@/lib/auth";

export async function GET() {
  const tokens = await getGoogleTokens();
  return NextResponse.json({
    connected: Boolean(tokens?.accessToken),
    configured: googleConfigured(),
  });
}
