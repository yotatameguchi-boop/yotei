import { asc, eq } from "drizzle-orm";
import { getDb } from "./index";
import { habits as habitsTable } from "./schema";
import type { DayOfWeek, Habit, TimeOfDay } from "../types";
import { createId } from "../types";

function rowToHabit(row: typeof habitsTable.$inferSelect): Habit {
  return {
    id: row.id,
    name: row.name,
    durationMinutes: row.durationMinutes,
    preferredTime: row.preferredTime as TimeOfDay,
    days: JSON.parse(row.daysJson) as DayOfWeek[],
  };
}

export async function listHabits(userId: string): Promise<Habit[]> {
  const db = getDb();
  const rows = await db.query.habits.findMany({
    where: eq(habitsTable.userId, userId),
    orderBy: [asc(habitsTable.sortOrder), asc(habitsTable.createdAt)],
  });
  return rows.map(rowToHabit);
}

export async function replaceHabits(userId: string, items: Habit[]): Promise<Habit[]> {
  const db = getDb();
  const now = new Date().toISOString();

  await db.delete(habitsTable).where(eq(habitsTable.userId, userId));

  if (items.length === 0) {
    return [];
  }

  await db.insert(habitsTable).values(
    items.map((habit, index) => ({
      id: habit.id || createId(),
      userId,
      name: habit.name,
      durationMinutes: habit.durationMinutes,
      preferredTime: habit.preferredTime,
      daysJson: JSON.stringify(habit.days),
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
    })),
  );

  return listHabits(userId);
}

export async function createHabit(
  userId: string,
  input: Omit<Habit, "id"> & { id?: string },
): Promise<Habit> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = input.id ?? createId();

  const existing = await db.query.habits.findMany({
    where: eq(habitsTable.userId, userId),
  });

  await db.insert(habitsTable).values({
    id,
    userId,
    name: input.name,
    durationMinutes: input.durationMinutes,
    preferredTime: input.preferredTime,
    daysJson: JSON.stringify(input.days),
    sortOrder: existing.length,
    createdAt: now,
    updatedAt: now,
  });

  const row = await db.query.habits.findFirst({
    where: eq(habitsTable.id, id),
  });

  if (!row) {
    throw new Error("Failed to create habit");
  }

  return rowToHabit(row);
}

export async function updateHabit(
  userId: string,
  habitId: string,
  input: Partial<Omit<Habit, "id">>,
): Promise<Habit | null> {
  const db = getDb();
  const existing = await db.query.habits.findFirst({
    where: eq(habitsTable.id, habitId),
  });

  if (!existing || existing.userId !== userId) {
    return null;
  }

  const now = new Date().toISOString();
  await db
    .update(habitsTable)
    .set({
      name: input.name ?? existing.name,
      durationMinutes: input.durationMinutes ?? existing.durationMinutes,
      preferredTime: input.preferredTime ?? existing.preferredTime,
      daysJson: input.days ? JSON.stringify(input.days) : existing.daysJson,
      updatedAt: now,
    })
    .where(eq(habitsTable.id, habitId));

  const row = await db.query.habits.findFirst({
    where: eq(habitsTable.id, habitId),
  });

  return row ? rowToHabit(row) : null;
}

export async function deleteHabit(userId: string, habitId: string): Promise<boolean> {
  const db = getDb();
  const existing = await db.query.habits.findFirst({
    where: eq(habitsTable.id, habitId),
  });

  if (!existing || existing.userId !== userId) {
    return false;
  }

  await db.delete(habitsTable).where(eq(habitsTable.id, habitId));
  return true;
}
