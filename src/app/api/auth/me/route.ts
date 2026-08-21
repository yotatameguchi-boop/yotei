import { NextResponse } from "next/server";
import { isNextResponse, requireApiUser } from "@/lib/api-auth";
import { getGoogleTokens, tokenValid } from "@/lib/auth";
import { getLatestSyncRun, getUserPreferences } from "@/lib/db/preferences";
import { listGoals } from "@/lib/db/goals";
import { listHabits } from "@/lib/db/habits";

export async function GET() {
  try {
    const user = await requireApiUser();
    const tokens = await getGoogleTokens();
    const [preferences, habits, goals, latestSync] = await Promise.all([
      getUserPreferences(user.id),
      listHabits(user.id),
      listGoals(user.id),
      getLatestSyncRun(user.id),
    ]);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        googleLinked: Boolean(user.googleSub),
      },
      preferences,
      habitsCount: habits.length,
      goalsCount: goals.length,
      googleConnected: tokenValid(tokens),
      latestSync,
    });
  } catch (error) {
    if (isNextResponse(error)) {
      return error;
    }
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}
