import { NextRequest, NextResponse } from "next/server";
import { isNextResponse, requireApiUser } from "@/lib/api-auth";
import { listGoals, replaceGoals } from "@/lib/db/goals";
import type { Goal } from "@/lib/types";

export async function GET() {
  try {
    const user = await requireApiUser();
    const goals = await listGoals(user.id);
    return NextResponse.json({ goals });
  } catch (error) {
    if (isNextResponse(error)) {
      return error;
    }
    return NextResponse.json({ error: "Failed to load goals" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = (await request.json()) as { goals?: Goal[] };

    if (!Array.isArray(body.goals)) {
      return NextResponse.json({ error: "goals array is required" }, { status: 400 });
    }

    const goals = await replaceGoals(user.id, body.goals);
    return NextResponse.json({ goals });
  } catch (error) {
    if (isNextResponse(error)) {
      return error;
    }
    return NextResponse.json({ error: "Failed to save goals" }, { status: 500 });
  }
}
