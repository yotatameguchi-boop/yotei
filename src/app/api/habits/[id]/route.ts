import { NextRequest, NextResponse } from "next/server";
import { isNextResponse, requireApiUser } from "@/lib/api-auth";
import { createHabit, deleteHabit, updateHabit } from "@/lib/db/habits";
import type { Habit } from "@/lib/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = (await request.json()) as Partial<Omit<Habit, "id">>;
    const habit = await updateHabit(user.id, id, body);

    if (!habit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }

    return NextResponse.json({ habit });
  } catch (error) {
    if (isNextResponse(error)) {
      return error;
    }
    return NextResponse.json({ error: "Failed to update habit" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const deleted = await deleteHabit(user.id, id);

    if (!deleted) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNextResponse(error)) {
      return error;
    }
    return NextResponse.json({ error: "Failed to delete habit" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = (await request.json()) as Omit<Habit, "id">;
    const habit = await createHabit(user.id, { ...body, id });
    return NextResponse.json({ habit }, { status: 201 });
  } catch (error) {
    if (isNextResponse(error)) {
      return error;
    }
    return NextResponse.json({ error: "Failed to create habit" }, { status: 500 });
  }
}
