import { getGoogleTokens, googleConfigured, saveGoogleTokens } from "@/lib/auth";
import { ScheduleApp } from "@/components/schedule-app";
import { getAuthorizedClient, listCalendarEvents } from "@/lib/google-calendar";
import { defaultRange } from "@/lib/storage";

export default async function Home() {
  const tokens = await getGoogleTokens();
  const configured = googleConfigured();
  const connected = Boolean(tokens?.accessToken);
  const range = defaultRange();
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auth/callback`;

  let initialGoogleEvents: Awaited<ReturnType<typeof listCalendarEvents>> = [];

  if (tokens?.accessToken) {
    try {
      const { tokens: refreshedTokens } = await getAuthorizedClient(tokens);
      await saveGoogleTokens(refreshedTokens);
      initialGoogleEvents = await listCalendarEvents(
        refreshedTokens,
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
      redirectUri={redirectUri}
      rangeStart={range.start}
      rangeEnd={range.end}
    />
  );
}
