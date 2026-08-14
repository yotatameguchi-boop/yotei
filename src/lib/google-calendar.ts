import { google } from "googleapis";
import { getGoogleClientId } from "./google-config";
import type { ScheduledBlock } from "./types";
import { buildYoteiKey, yoteiEventTitle } from "./yotei-calendar-key";

const TIMEZONE = "Asia/Tokyo";

export type GoogleAccessToken = {
  accessToken: string;
  expiryDate?: number;
};

function getAuthClient(accessToken: string) {
  const clientId = getGoogleClientId() ?? "";
  const auth = new google.auth.OAuth2(clientId);
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

function assertTokenValid(tokens: GoogleAccessToken) {
  if (!tokens.accessToken) {
    throw new Error("Google Calendar is not connected");
  }

  if (tokens.expiryDate && tokens.expiryDate <= Date.now() + 30_000) {
    throw new Error("TOKEN_EXPIRED");
  }
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
  tokens: GoogleAccessToken,
  timeMin: string,
  timeMax: string,
): Promise<RawListedEvent[]> {
  assertTokenValid(tokens);
  const calendar = google.calendar({ version: "v3", auth: getAuthClient(tokens.accessToken) });

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
  tokens: GoogleAccessToken,
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
  tokens: GoogleAccessToken,
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
  tokens: GoogleAccessToken,
  blocks: ScheduledBlock[],
  timeMin: string,
  timeMax: string,
) {
  assertTokenValid(tokens);
  const calendar = google.calendar({ version: "v3", auth: getAuthClient(tokens.accessToken) });
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
