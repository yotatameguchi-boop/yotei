import { NextRequest, NextResponse } from "next/server";
import { getGoogleTokens, saveGoogleTokens } from "@/lib/auth";
import { generateFromInput, type SyncCalendarRequest } from "@/lib/calendar-sync";
import {
  getAuthorizedClient,
  listCalendarEvents,
  listExternalBusyEvents,
  upsertScheduledBlocks,
} from "@/lib/google-calendar";

export async function POST(request: NextRequest) {
  const tokens = await getGoogleTokens();
  if (!tokens) {
    return NextResponse.json({ error: "Google Calendar is not connected" }, { status: 401 });
  }

  const body = (await request.json()) as SyncCalendarRequest;

  if (!body.rangeStart || !body.rangeEnd) {
    return NextResponse.json({ error: "rangeStart and rangeEnd are required" }, { status: 400 });
  }

  try {
    const { tokens: refreshedTokens } = await getAuthorizedClient(tokens);
    await saveGoogleTokens(refreshedTokens);

    const externalEvents = await listExternalBusyEvents(
      refreshedTokens,
      body.rangeStart,
      body.rangeEnd,
    );

    const schedule = generateFromInput(body, externalEvents);

    let pushed = { created: 0, updated: 0 };
    const shouldPush = body.pushToGoogle !== false;

    if (shouldPush && schedule.scheduled.length > 0) {
      pushed = await upsertScheduledBlocks(
        refreshedTokens,
        schedule.scheduled,
        body.rangeStart,
        body.rangeEnd,
      );
    }

    const googleEvents = await listCalendarEvents(
      refreshedTokens,
      body.rangeStart,
      body.rangeEnd,
    );

    return NextResponse.json({
      googleEvents,
      scheduled: schedule.scheduled,
      unscheduled: schedule.unscheduled,
      pushed,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync calendar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
