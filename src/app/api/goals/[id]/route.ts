import { NextRequest, NextResponse } from "next/server";
import { isNextResponse, requireApiUser } from "@/lib/api-auth";
import { createGoal, deleteGoal, updateGoal } from "@/lib/db/goals";
import type { Goal } from "@/lib/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = (await request.json()) as Partial<Omit<Goal, "id">>;
    const goal = await updateGoal(user.id, id, body);

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    return NextResponse.json({ goal });
  } catch (error) {
    if (isNextResponse(error)) {
      return error;
    }
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const deleted = await deleteGoal(user.id, id);

    if (!deleted) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNextResponse(error)) {
      return error;
    }
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = (await request.json()) as Omit<Goal, "id">;
    const goal = await createGoal(user.id, { ...body, id });
    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    if (isNextResponse(error)) {
      return error;
    }
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
  }
}
