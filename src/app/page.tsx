import { getGoogleTokens, tokenValid } from "@/lib/auth";
import { ScheduleApp } from "@/components/schedule-app";
import { googleCalendarAvailable, getGoogleClientId } from "@/lib/google-config";
import { listCalendarEvents } from "@/lib/google-calendar";
import { listGoals } from "@/lib/db/goals";
import { listHabits } from "@/lib/db/habits";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { getLatestSyncRun, getUserPreferences, upsertUserPreferences } from "@/lib/db/preferences";
import { replaceGoals } from "@/lib/db/goals";
import { replaceHabits } from "@/lib/db/habits";
import { defaultRange } from "@/lib/storage";
import { getOrCreateSessionUser } from "@/lib/user-session";
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
    initialized: true,
    useDemoEvents: false,
  };
  let latestSyncAt: string | null = null;
  let dbConfigured = true;

  try {
    const user = await getOrCreateSessionUser();
    preferences = await getUserPreferences(user.id);
    habits = await listHabits(user.id);
    goals = await listGoals(user.id);
    const latestSync = await getLatestSyncRun(user.id);
    latestSyncAt = latestSync?.syncedAt ?? null;

    if (!preferences.initialized && habits.length === 0 && goals.length === 0) {
      habits = createDemoHabits();
      goals = createDemoGoals();
      await replaceHabits(user.id, habits);
      await replaceGoals(user.id, goals);
      preferences = await upsertUserPreferences(user.id, { initialized: true });
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
