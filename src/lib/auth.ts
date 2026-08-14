import { cookies } from "next/headers";
import type { GoogleTokenPayload } from "./types";

const TOKEN_COOKIE = "yotei_google_tokens";
const STATE_COOKIE = "yotei_oauth_state";

function getAuthSecret(): string | null {
  return process.env.AUTH_SECRET ?? null;
}

function encodePayload(payload: unknown): string {
  const secret = getAuthSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }

  const json = JSON.stringify(payload);
  const data = Buffer.from(json, "utf8").toString("base64url");
  const signature = Buffer.from(`${data}.${secret}`, "utf8").toString("base64url");
  return `${data}.${signature}`;
}

function decodePayload<T>(value: string): T | null {
  const secret = getAuthSecret();
  if (!secret) {
    return null;
  }

  const [data, signature] = value.split(".");
  if (!data || !signature) {
    return null;
  }

  const expected = Buffer.from(`${data}.${secret}`, "utf8").toString("base64url");
  if (signature !== expected) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function setOAuthState(state: string) {
  const store = await cookies();
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function consumeOAuthState(state: string): Promise<boolean> {
  const store = await cookies();
  const saved = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  return Boolean(saved && saved === state);
}

export async function saveGoogleTokens(tokens: GoogleTokenPayload) {
  const store = await cookies();
  store.set(TOKEN_COOKIE, encodePayload(tokens), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getGoogleTokens(): Promise<GoogleTokenPayload | null> {
  const store = await cookies();
  const raw = store.get(TOKEN_COOKIE)?.value;
  if (!raw) {
    return null;
  }
  return decodePayload<GoogleTokenPayload>(raw);
}

export async function clearGoogleTokens() {
  const store = await cookies();
  store.delete(TOKEN_COOKIE);
}

export function googleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.AUTH_SECRET,
  );
}
