import { NextRequest, NextResponse } from "next/server";
import { getGoogleTokens } from "@/lib/auth";
import { upsertScheduledBlocks } from "@/lib/google-calendar";
import type { ScheduledBlock } from "@/lib/types";

type PushBody = {
  events: Array<{
    title: string;
    start: string;
    end: string;
    description?: string;
  }>;
  rangeStart?: string;
  rangeEnd?: string;
  scheduled?: ScheduledBlock[];
};

export async function POST(request: NextRequest) {
  const tokens = await getGoogleTokens();
  if (!tokens?.accessToken) {
    return NextResponse.json({ error: "Google Calendar is not connected" }, { status: 401 });
  }

  const body = (await request.json()) as PushBody;

  if (body.scheduled?.length && body.rangeStart && body.rangeEnd) {
    try {
      const pushed = await upsertScheduledBlocks(
        tokens,
        body.scheduled,
        body.rangeStart,
        body.rangeEnd,
      );
      return NextResponse.json({ createdCount: pushed.created + pushed.updated, ...pushed });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to push events";
      const status = message === "TOKEN_EXPIRED" ? 401 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  return NextResponse.json({ error: "scheduled blocks are required" }, { status: 400 });
}
