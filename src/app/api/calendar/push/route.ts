import { NextRequest, NextResponse } from "next/server";
import { getGoogleTokens, saveGoogleTokens } from "@/lib/auth";
import { getAuthorizedClient, pushEventsToCalendar } from "@/lib/google-calendar";

type PushBody = {
  events: Array<{
    title: string;
    start: string;
    end: string;
    description?: string;
  }>;
};

export async function POST(request: NextRequest) {
  const tokens = await getGoogleTokens();
  if (!tokens) {
    return NextResponse.json({ error: "Google Calendar is not connected" }, { status: 401 });
  }

  const body = (await request.json()) as PushBody;
  if (!body.events?.length) {
    return NextResponse.json({ error: "events are required" }, { status: 400 });
  }

  try {
    const { tokens: refreshedTokens } = await getAuthorizedClient(tokens);
    await saveGoogleTokens(refreshedTokens);
    const created = await pushEventsToCalendar(refreshedTokens, body.events);
    return NextResponse.json({ createdCount: created.length, created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to push events";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
