import { NextResponse } from "next/server";
import { getOrCreateSessionUser } from "@/lib/user-session";

export async function requireApiUser() {
  try {
    return await getOrCreateSessionUser();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database unavailable";
    throw NextResponse.json({ error: message }, { status: 503 });
  }
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
