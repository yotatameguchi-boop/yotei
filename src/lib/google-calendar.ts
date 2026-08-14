import { google } from "googleapis";
import type { ScheduledBlock } from "./types";
import { buildYoteiKey, yoteiEventTitle } from "./yotei-calendar-key";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

const TIMEZONE = "Asia/Tokyo";

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auth/callback`;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are not configured");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(state: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token) {
    throw new Error("Google did not return an access token");
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? undefined,
    expiryDate: tokens.expiry_date ?? undefined,
  };
}

export async function getAuthorizedClient(tokens: {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}) {
  const client = getOAuthClient();
  const nextTokens = { ...tokens };

  client.setCredentials({
    access_token: nextTokens.accessToken,
    refresh_token: nextTokens.refreshToken,
    expiry_date: nextTokens.expiryDate,
  });

  if (
    nextTokens.expiryDate &&
    nextTokens.expiryDate <= Date.now() + 60_000 &&
    nextTokens.refreshToken
  ) {
    const refreshed = await client.refreshAccessToken();
    const credentials = refreshed.credentials;

    if (credentials.access_token) {
      nextTokens.accessToken = credentials.access_token;
      nextTokens.expiryDate = credentials.expiry_date ?? undefined;
      if (credentials.refresh_token) {
        nextTokens.refreshToken = credentials.refresh_token;
      }
      client.setCredentials(credentials);
    }
  }

  return { client, tokens: nextTokens };
}

function parseEventTime(
  dateTime?: string | null,
  date?: string | null,
  fallbackEnd?: boolean,
): string | null {
  if (dateTime) {
    return dateTime;
  }

  if (date) {
    const parsed = new Date(`${date}T${fallbackEnd ? "23:59:59" : "00:00:00"}`);
    return parsed.toISOString();
  }

  return null;
}

type RawListedEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  yoteiKey?: string;
  yoteiKind?: "habit" | "task";
};

async function listRawEvents(
  tokens: { accessToken: string; refreshToken?: string; expiryDate?: number },
  timeMin: string,
  timeMax: string,
): Promise<RawListedEvent[]> {
  const { client } = await getAuthorizedClient(tokens);
  const calendar = google.calendar({ version: "v3", auth: client });

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
  });

  return (response.data.items ?? [])
    .map((item) => {
      const start = parseEventTime(item.start?.dateTime, item.start?.date, false);
      const end = parseEventTime(item.end?.dateTime, item.end?.date, true);

      if (!start || !end || !item.id) {
        return null;
      }

      const event: RawListedEvent = {
        id: item.id,
        title: item.summary ?? "（無題）",
        start,
        end,
        yoteiKey: item.extendedProperties?.private?.yoteiKey,
        yoteiKind: item.extendedProperties?.private?.yoteiKind as "habit" | "task" | undefined,
      };
      return event;
    })
    .filter((item): item is RawListedEvent => item !== null);
}

export async function listExternalBusyEvents(
  tokens: { accessToken: string; refreshToken?: string; expiryDate?: number },
  timeMin: string,
  timeMax: string,
) {
  const events = await listRawEvents(tokens, timeMin, timeMax);

  return events
    .filter((event) => !event.yoteiKey)
    .map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      source: "google" as const,
      color: "#647880",
    }));
}

export async function listCalendarEvents(
  tokens: { accessToken: string; refreshToken?: string; expiryDate?: number },
  timeMin: string,
  timeMax: string,
) {
  const events = await listRawEvents(tokens, timeMin, timeMax);

  return events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    source: (event.yoteiKind ?? (event.yoteiKey ? "habit" : "google")) as
      | "google"
      | "habit"
      | "task",
    color:
      event.yoteiKind === "task"
        ? "#8ec4b0"
        : event.yoteiKey
          ? "#6aabbf"
          : "#647880",
  }));
}

export async function upsertScheduledBlocks(
  tokens: { accessToken: string; refreshToken?: string; expiryDate?: number },
  blocks: ScheduledBlock[],
  timeMin: string,
  timeMax: string,
) {
  const { client } = await getAuthorizedClient(tokens);
  const calendar = google.calendar({ version: "v3", auth: client });
  const existing = await listRawEvents(tokens, timeMin, timeMax);
  const existingByKey = new Map(
    existing.filter((event) => event.yoteiKey).map((event) => [event.yoteiKey!, event.id]),
  );

  let created = 0;
  let updated = 0;

  for (const block of blocks) {
    if (block.kind === "google") {
      continue;
    }

    const yoteiKey = buildYoteiKey(block);
    const requestBody = {
      summary: yoteiEventTitle(block.title),
      description: "yotei アプリから自動同期",
      start: {
        dateTime: block.start,
        timeZone: TIMEZONE,
      },
      end: {
        dateTime: block.end,
        timeZone: TIMEZONE,
      },
      extendedProperties: {
        private: {
          yoteiKey,
          yoteiKind: block.kind,
          yoteiRefId: block.refId,
        },
      },
    };

    const existingId = existingByKey.get(yoteiKey);
    if (existingId) {
      await calendar.events.update({
        calendarId: "primary",
        eventId: existingId,
        requestBody,
      });
      updated += 1;
    } else {
      await calendar.events.insert({
        calendarId: "primary",
        requestBody,
      });
      created += 1;
    }
  }

  return { created, updated };
}

export async function pushEventsToCalendar(
  tokens: { accessToken: string; refreshToken?: string; expiryDate?: number },
  events: Array<{ title: string; start: string; end: string; description?: string }>,
) {
  const { client } = await getAuthorizedClient(tokens);
  const calendar = google.calendar({ version: "v3", auth: client });
  const created: string[] = [];

  for (const event of events) {
    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: event.title,
        description: event.description,
        start: {
          dateTime: event.start,
          timeZone: TIMEZONE,
        },
        end: {
          dateTime: event.end,
          timeZone: TIMEZONE,
        },
      },
    });

    if (response.data.id) {
      created.push(response.data.id);
    }
  }

  return created;
}
