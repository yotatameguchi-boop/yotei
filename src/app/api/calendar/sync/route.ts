import { NextRequest, NextResponse } from "next/server";
import { getGoogleTokens } from "@/lib/auth";
import { isNextResponse, requireApiUser } from "@/lib/api-auth";
import { generateFromInput, type SyncCalendarRequest } from "@/lib/calendar-sync";
import { listGoals } from "@/lib/db/goals";
import { listHabits } from "@/lib/db/habits";
import { recordSyncRun } from "@/lib/db/preferences";
import {
  listCalendarEvents,
  listExternalBusyEvents,
  upsertScheduledBlocks,
} from "@/lib/google-calendar";

type SyncRequestBody = SyncCalendarRequest & {
  useStoredData?: boolean;
};

export async function POST(request: NextRequest) {
  const tokens = await getGoogleTokens();
  if (!tokens?.accessToken) {
    return NextResponse.json({ error: "Google Calendar is not connected" }, { status: 401 });
  }

  let user;
  try {
    user = await requireApiUser();
  } catch (error) {
    if (isNextResponse(error)) {
      return error;
    }
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const body = (await request.json()) as SyncRequestBody;

  if (!body.rangeStart || !body.rangeEnd) {
    return NextResponse.json({ error: "rangeStart and rangeEnd are required" }, { status: 400 });
  }

  const useStoredData = body.useStoredData !== false;
  const habits =
    useStoredData && (!body.habits || body.habits.length === 0)
      ? await listHabits(user.id)
      : (body.habits ?? []);
  const goals =
    useStoredData && (!body.goals || body.goals.length === 0)
      ? await listGoals(user.id)
      : (body.goals ?? []);

  const syncInput: SyncCalendarRequest = {
    habits,
    goals,
    rangeStart: body.rangeStart,
    rangeEnd: body.rangeEnd,
    pushToGoogle: body.pushToGoogle,
  };

  try {
    const externalEvents = await listExternalBusyEvents(
      tokens,
      body.rangeStart,
      body.rangeEnd,
    );

    const schedule = generateFromInput(syncInput, externalEvents);

    let pushed = { created: 0, updated: 0 };
    const shouldPush = body.pushToGoogle !== false;

    if (shouldPush && schedule.scheduled.length > 0) {
      pushed = await upsertScheduledBlocks(
        tokens,
        schedule.scheduled,
        body.rangeStart,
        body.rangeEnd,
      );
    }

    const googleEvents = await listCalendarEvents(
      tokens,
      body.rangeStart,
      body.rangeEnd,
    );

    const syncedAt = new Date().toISOString();
    await recordSyncRun(user.id, {
      rangeStart: body.rangeStart,
      rangeEnd: body.rangeEnd,
      scheduledCount: schedule.scheduled.length,
      unscheduledCount: schedule.unscheduled.length,
      pushedCreated: pushed.created,
      pushedUpdated: pushed.updated,
      syncedAt,
    });

    return NextResponse.json({
      googleEvents,
      scheduled: schedule.scheduled,
      unscheduled: schedule.unscheduled,
      pushed,
      syncedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync calendar";
    const status = message === "TOKEN_EXPIRED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
