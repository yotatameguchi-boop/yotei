import { NextRequest, NextResponse } from "next/server";
import { getGoogleTokens, saveGoogleTokens } from "@/lib/auth";
import { getAuthorizedClient, listCalendarEvents } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const tokens = await getGoogleTokens();
  if (!tokens) {
    return NextResponse.json({ error: "Google Calendar is not connected" }, { status: 401 });
  }

  const timeMin = request.nextUrl.searchParams.get("timeMin");
  const timeMax = request.nextUrl.searchParams.get("timeMax");

  if (!timeMin || !timeMax) {
    return NextResponse.json({ error: "timeMin and timeMax are required" }, { status: 400 });
  }

  try {
    const { tokens: refreshedTokens } = await getAuthorizedClient(tokens);
    await saveGoogleTokens(refreshedTokens);
    const events = await listCalendarEvents(refreshedTokens, timeMin, timeMax);
    return NextResponse.json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch events";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
