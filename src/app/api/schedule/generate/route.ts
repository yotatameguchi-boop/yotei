import { NextRequest, NextResponse } from "next/server";
import { generateSchedule } from "@/lib/scheduler";
import type { GenerateScheduleRequest } from "@/lib/types";
import { ensureGoalSubtasks } from "@/lib/task-splitter";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateScheduleRequest;

  if (!body.rangeStart || !body.rangeEnd) {
    return NextResponse.json({ error: "rangeStart and rangeEnd are required" }, { status: 400 });
  }

  const result = generateSchedule({
    ...body,
    habits: body.habits ?? [],
    goals: ensureGoalSubtasks(body.goals ?? []),
    googleEvents: body.googleEvents ?? [],
  });

  return NextResponse.json(result);
}
