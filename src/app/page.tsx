import { getGoogleTokens, tokenValid } from "@/lib/auth";
import { ScheduleApp } from "@/components/schedule-app";
import { googleCalendarAvailable, getGoogleClientId } from "@/lib/google-config";
import { listCalendarEvents } from "@/lib/google-calendar";
import { defaultRange } from "@/lib/storage";

export default async function Home() {
  const tokens = await getGoogleTokens();
  const configured = googleCalendarAvailable();
  const connected = tokenValid(tokens);
  const range = defaultRange();
  const googleClientId = getGoogleClientId() ?? "";

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
      googleClientId={googleClientId}
      rangeStart={range.start}
      rangeEnd={range.end}
    />
  );
}
