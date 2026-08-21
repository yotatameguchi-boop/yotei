import { getGoogleTokens, tokenValid } from "@/lib/auth";
import { ScheduleApp } from "@/components/schedule-app";
import { googleCalendarAvailable, getGoogleClientId } from "@/lib/google-config";
import { listCalendarEvents } from "@/lib/google-calendar";
import { listGoals } from "@/lib/db/goals";
import { listHabits } from "@/lib/db/habits";
import { getLatestSyncRun, getUserPreferences } from "@/lib/db/preferences";
import { defaultRange } from "@/lib/storage";
import { getOrCreateSessionUser } from "@/lib/user-session";
import {
  createDemoGoals,
  createDemoHabits,
} from "@/lib/demo-data";
import { upsertUserPreferences } from "@/lib/db/preferences";
import { replaceGoals } from "@/lib/db/goals";
import { replaceHabits } from "@/lib/db/habits";

export default async function Home() {
  const tokens = await getGoogleTokens();
  const configured = googleCalendarAvailable();
  const connected = tokenValid(tokens);
  const range = defaultRange();
  const googleClientId = getGoogleClientId() ?? "";

  const user = await getOrCreateSessionUser();
  let preferences = await getUserPreferences(user.id);
  let habits = await listHabits(user.id);
  let goals = await listGoals(user.id);
  const latestSync = await getLatestSyncRun(user.id);

  if (!preferences.initialized && habits.length === 0 && goals.length === 0) {
    habits = createDemoHabits();
    goals = createDemoGoals();
    await replaceHabits(user.id, habits);
    await replaceGoals(user.id, goals);
    preferences = await upsertUserPreferences(user.id, { initialized: true });
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
      initialLastSyncedAt={latestSync?.syncedAt ?? null}
      googleClientId={googleClientId}
      rangeStart={range.start}
      rangeEnd={range.end}
    />
  );
}
