import { NextResponse } from "next/server";
import { getGoogleTokens, tokenExpiringSoon, tokenValid } from "@/lib/auth";
import { googleCalendarAvailable } from "@/lib/google-config";

export async function GET() {
  const tokens = await getGoogleTokens();

  return NextResponse.json({
    connected: tokenValid(tokens),
    configured: googleCalendarAvailable(),
    expiringSoon: tokenExpiringSoon(tokens),
  });
}
