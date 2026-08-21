import { NextRequest, NextResponse } from "next/server";
import { isNextResponse, requireApiUser } from "@/lib/api-auth";
import { listHabits, replaceHabits } from "@/lib/db/habits";
import type { Habit } from "@/lib/types";

export async function GET() {
  try {
    const user = await requireApiUser();
    const habits = await listHabits(user.id);
    return NextResponse.json({ habits });
  } catch (error) {
    if (isNextResponse(error)) {
      return error;
    }
    return NextResponse.json({ error: "Failed to load habits" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = (await request.json()) as { habits?: Habit[] };

    if (!Array.isArray(body.habits)) {
      return NextResponse.json({ error: "habits array is required" }, { status: 400 });
    }

    const habits = await replaceHabits(user.id, body.habits);
    return NextResponse.json({ habits });
  } catch (error) {
    if (isNextResponse(error)) {
      return error;
    }
    return NextResponse.json({ error: "Failed to save habits" }, { status: 500 });
  }
}
