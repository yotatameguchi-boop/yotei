import { getGoogleTokens, tokenValid } from "@/lib/auth";
import { ScheduleApp } from "@/components/schedule-app";
import { googleCalendarAvailable, getGoogleClientId } from "@/lib/google-config";
import { listCalendarEvents } from "@/lib/google-calendar";
import { listGoals } from "@/lib/db/goals";
import { listHabits } from "@/lib/db/habits";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { getLatestSyncRun, getUserPreferences } from "@/lib/db/preferences";
import { defaultRange } from "@/lib/storage";
import { getSessionUser } from "@/lib/user-session";
import {
  createDemoGoals,
  createDemoHabits,
} from "@/lib/demo-data";
import type { Goal, Habit } from "@/lib/types";

export default async function Home() {
  const tokens = await getGoogleTokens();
  const configured = googleCalendarAvailable();
  const connected = tokenValid(tokens);
  const range = defaultRange();
  const googleClientId = getGoogleClientId() ?? "";

  let habits: Habit[] = createDemoHabits();
  let goals: Goal[] = createDemoGoals();
  let preferences = {
    autoSync: true,
    initialized: false,
    useDemoEvents: false,
  };
  let latestSyncAt: string | null = null;
  let dbConfigured = true;

  try {
    const user = await getSessionUser();
    if (user) {
      preferences = await getUserPreferences(user.id);
      habits = await listHabits(user.id);
      goals = await listGoals(user.id);
      const latestSync = await getLatestSyncRun(user.id);
      latestSyncAt = latestSync?.syncedAt ?? null;
    }
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      dbConfigured = false;
    } else {
      throw error;
    }
  }

  let initialGoogleEvents: Awaited<ReturnType<typeof listCalendarEvents>> = [];

  if (connected && tokens) {
    try {
      initialGoogleEvents = await listCalendarEvents(
        tokens,
        range.start,
        range.end,
      );
    } catch {
      initialGoogleEvents = [];
    }
  }

  return (
    <ScheduleApp
      initialConnected={connected}
      initialConfigured={configured}
      initialGoogleEvents={initialGoogleEvents}
      initialHabits={habits}
      initialGoals={goals}
      initialAutoSync={preferences.autoSync}
      initialUseDemoEvents={preferences.useDemoEvents}
      initialLastSyncedAt={latestSyncAt}
      dbConfigured={dbConfigured}
      googleClientId={googleClientId}
      rangeStart={range.start}
      rangeEnd={range.end}
    />
  );
}
