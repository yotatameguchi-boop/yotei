import { NextResponse } from "next/server";
import { isNextResponse, requireApiUser } from "@/lib/api-auth";
import { createDemoGoals, createDemoHabits } from "@/lib/demo-data";
import { listGoals, replaceGoals } from "@/lib/db/goals";
import { listHabits, replaceHabits } from "@/lib/db/habits";
import { getLatestSyncRun, getUserPreferences, upsertUserPreferences } from "@/lib/db/preferences";

export async function GET() {
  try {
    const user = await requireApiUser();
    let preferences = await getUserPreferences(user.id);
    let habits = await listHabits(user.id);
    let goals = await listGoals(user.id);

    if (!preferences.initialized && habits.length === 0 && goals.length === 0) {
      habits = await replaceHabits(user.id, createDemoHabits());
      goals = await replaceGoals(user.id, createDemoGoals());
      preferences = await upsertUserPreferences(user.id, { initialized: true });
    }

    const latestSync = await getLatestSyncRun(user.id);

    return NextResponse.json({
      habits,
      goals,
      preferences,
      latestSync,
    });
  } catch (error) {
    if (isNextResponse(error)) {
      return error;
    }
    return NextResponse.json({ error: "Failed to bootstrap user data" }, { status: 500 });
  }
}
