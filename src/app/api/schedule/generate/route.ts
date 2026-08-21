import { NextRequest, NextResponse } from "next/server";
import { isNextResponse, requireApiUser } from "@/lib/api-auth";
import { generateFromInput, type SyncCalendarRequest } from "@/lib/calendar-sync";
import { listGoals } from "@/lib/db/goals";
import { listHabits } from "@/lib/db/habits";
import type { CalendarEvent } from "@/lib/types";

type GenerateRequestBody = SyncCalendarRequest & {
  googleEvents?: CalendarEvent[];
  useStoredData?: boolean;
};

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireApiUser();
  } catch (error) {
    if (isNextResponse(error)) {
      return error;
    }
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const body = (await request.json()) as GenerateRequestBody;

  if (!body.rangeStart || !body.rangeEnd) {
    return NextResponse.json({ error: "rangeStart and rangeEnd are required" }, { status: 400 });
  }

  const useStoredData = body.useStoredData !== false;
  const habits =
    useStoredData && (!body.habits || body.habits.length === 0)
      ? await listHabits(user.id)
      : (body.habits ?? []);
  const goals =
    useStoredData && (!body.goals || body.goals.length === 0)
      ? await listGoals(user.id)
      : (body.goals ?? []);

  const schedule = generateFromInput(
    {
      habits,
      goals,
      rangeStart: body.rangeStart,
      rangeEnd: body.rangeEnd,
    },
    body.googleEvents ?? [],
  );

  return NextResponse.json(schedule);
}
