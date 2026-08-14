import { NextRequest, NextResponse } from "next/server";
import { getGoogleTokens } from "@/lib/auth";
import { listCalendarEvents } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const tokens = await getGoogleTokens();
  if (!tokens?.accessToken) {
    return NextResponse.json({ error: "Google Calendar is not connected" }, { status: 401 });
  }

  const timeMin = request.nextUrl.searchParams.get("timeMin");
  const timeMax = request.nextUrl.searchParams.get("timeMax");

  if (!timeMin || !timeMax) {
    return NextResponse.json({ error: "timeMin and timeMax are required" }, { status: 400 });
  }

  try {
    const events = await listCalendarEvents(tokens, timeMin, timeMax);
    return NextResponse.json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch events";
    const status = message === "TOKEN_EXPIRED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
