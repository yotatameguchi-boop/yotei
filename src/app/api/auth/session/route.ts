import { NextRequest, NextResponse } from "next/server";
import { clearGoogleTokens, saveGoogleTokens } from "@/lib/auth";
import { googleCalendarAvailable } from "@/lib/google-config";

type SessionBody = {
  accessToken: string;
  expiresIn?: number;
};

export async function POST(request: NextRequest) {
  if (!googleCalendarAvailable()) {
    return NextResponse.json(
      { error: "Google Calendar integration is not available" },
      { status: 503 },
    );
  }

  const body = (await request.json()) as SessionBody;

  if (!body.accessToken) {
    return NextResponse.json({ error: "accessToken is required" }, { status: 400 });
  }

  const expiresIn = body.expiresIn ?? 3600;
  await saveGoogleTokens({
    accessToken: body.accessToken,
    expiryDate: Date.now() + expiresIn * 1000,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearGoogleTokens();
  return NextResponse.json({ ok: true });
}
