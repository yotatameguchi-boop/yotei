import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google-calendar";
import { googleConfigured, setOAuthState } from "@/lib/auth";

export async function GET() {
  if (!googleConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
      { status: 503 },
    );
  }

  const state = crypto.randomUUID();
  await setOAuthState(state);
  const url = getAuthUrl(state);
  return NextResponse.redirect(url);
}
