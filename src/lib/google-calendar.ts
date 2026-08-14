import { google } from "googleapis";
import type { GoogleTokenPayload } from "./types";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

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

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenPayload> {
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

export async function getAuthorizedClient(
  tokens: GoogleTokenPayload,
): Promise<{ client: ReturnType<typeof getOAuthClient>; tokens: GoogleTokenPayload }> {
  const client = getOAuthClient();
  const nextTokens: GoogleTokenPayload = { ...tokens };

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

export async function listCalendarEvents(
  tokens: GoogleTokenPayload,
  timeMin: string,
  timeMax: string,
) {
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

      if (!start || !end) {
        return null;
      }

      return {
        id: item.id ?? crypto.randomUUID(),
        title: item.summary ?? "（無題）",
        start,
        end,
        source: "google" as const,
        color: "#647880",
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

export async function pushEventsToCalendar(
  tokens: GoogleTokenPayload,
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
          timeZone: "Asia/Tokyo",
        },
        end: {
          dateTime: event.end,
          timeZone: "Asia/Tokyo",
        },
      },
    });

    if (response.data.id) {
      created.push(response.data.id);
    }
  }

  return created;
}
