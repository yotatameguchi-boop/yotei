import { cookies } from "next/headers";
import type { GoogleTokenPayload } from "./types";

const TOKEN_COOKIE = "yotei_google_tokens";

function getAuthSecret(): string {
  if (process.env.AUTH_SECRET) {
    return process.env.AUTH_SECRET;
  }

  const host =
    process.env.VERCEL_URL ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "") ??
    "localhost";

  return `yotei-cookie-${host}`;
}

function encodePayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  const data = Buffer.from(json, "utf8").toString("base64url");
  const signature = Buffer.from(`${data}.${getAuthSecret()}`, "utf8").toString("base64url");
  return `${data}.${signature}`;
}

function decodePayload<T>(value: string): T | null {
  const [data, signature] = value.split(".");
  if (!data || !signature) {
    return null;
  }

  const expected = Buffer.from(`${data}.${getAuthSecret()}`, "utf8").toString("base64url");
  if (signature !== expected) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
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

export function tokenExpiringSoon(tokens: GoogleTokenPayload | null): boolean {
  if (!tokens?.expiryDate) {
    return false;
  }
  return tokens.expiryDate <= Date.now() + 5 * 60_000;
}

export function tokenValid(tokens: GoogleTokenPayload | null): boolean {
  if (!tokens?.accessToken) {
    return false;
  }
  if (!tokens.expiryDate) {
    return true;
  }
  return tokens.expiryDate > Date.now() + 30_000;
}
