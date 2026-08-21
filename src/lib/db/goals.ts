import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "./index";
import { goals as goalsTable, subtasks as subtasksTable } from "./schema";
import type { Goal, Subtask } from "../types";
import { createId } from "../types";

function rowToGoal(
  row: typeof goalsTable.$inferSelect,
  subtaskRows: typeof subtasksTable.$inferSelect[],
): Goal {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    totalMinutes: row.totalMinutes,
    deadline: row.deadline,
    chunkMinutes: row.chunkMinutes,
    priority: row.priority,
    subtasks: subtaskRows
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(
        (subtask): Subtask => ({
          id: subtask.id,
          title: subtask.title,
          estimatedMinutes: subtask.estimatedMinutes,
          completed: subtask.completed,
        }),
      ),
  };
}

async function loadGoalsWithSubtasks(userId: string): Promise<Goal[]> {
  const db = getDb();
  const goalRows = await db.query.goals.findMany({
    where: eq(goalsTable.userId, userId),
    orderBy: [asc(goalsTable.priority), asc(goalsTable.createdAt)],
  });

  if (goalRows.length === 0) {
    return [];
  }

  const goalIds = goalRows.map((row) => row.id);
  const subtaskRows = await db.query.subtasks.findMany({
    where: inArray(subtasksTable.goalId, goalIds),
    orderBy: [asc(subtasksTable.sortOrder)],
  });

  const subtasksByGoal = new Map<string, typeof subtasksTable.$inferSelect[]>();
  for (const subtask of subtaskRows) {
    const list = subtasksByGoal.get(subtask.goalId) ?? [];
    list.push(subtask);
    subtasksByGoal.set(subtask.goalId, list);
  }

  return goalRows.map((row) => rowToGoal(row, subtasksByGoal.get(row.id) ?? []));
}

export async function listGoals(userId: string): Promise<Goal[]> {
  return loadGoalsWithSubtasks(userId);
}

export async function replaceGoals(userId: string, items: Goal[]): Promise<Goal[]> {
  const db = getDb();
  const now = new Date().toISOString();

  const existingGoals = await db.query.goals.findMany({
    where: eq(goalsTable.userId, userId),
  });

  if (existingGoals.length > 0) {
    const goalIds = existingGoals.map((goal) => goal.id);
    await db.delete(subtasksTable).where(inArray(subtasksTable.goalId, goalIds));
    await db.delete(goalsTable).where(eq(goalsTable.userId, userId));
  }

  for (const goal of items) {
    const goalId = goal.id || createId();
    await db.insert(goalsTable).values({
      id: goalId,
      userId,
      title: goal.title,
      description: goal.description,
      totalMinutes: goal.totalMinutes,
      deadline: goal.deadline,
      chunkMinutes: goal.chunkMinutes,
      priority: goal.priority,
      createdAt: now,
      updatedAt: now,
    });

    if (goal.subtasks.length > 0) {
      await db.insert(subtasksTable).values(
        goal.subtasks.map((subtask, index) => ({
          id: subtask.id || createId(),
          goalId,
          title: subtask.title,
          estimatedMinutes: subtask.estimatedMinutes,
          completed: subtask.completed,
          sortOrder: index,
        })),
      );
    }
  }

  return loadGoalsWithSubtasks(userId);
}

export async function createGoal(
  userId: string,
  input: Omit<Goal, "id"> & { id?: string },
): Promise<Goal> {
  const db = getDb();
  const now = new Date().toISOString();
  const goalId = input.id ?? createId();

  await db.insert(goalsTable).values({
    id: goalId,
    userId,
    title: input.title,
    description: input.description,
    totalMinutes: input.totalMinutes,
    deadline: input.deadline,
    chunkMinutes: input.chunkMinutes,
    priority: input.priority,
    createdAt: now,
    updatedAt: now,
  });

  if (input.subtasks.length > 0) {
    await db.insert(subtasksTable).values(
      input.subtasks.map((subtask, index) => ({
        id: subtask.id || createId(),
        goalId,
        title: subtask.title,
        estimatedMinutes: subtask.estimatedMinutes,
        completed: subtask.completed,
        sortOrder: index,
      })),
    );
  }

  const goals = await loadGoalsWithSubtasks(userId);
  const created = goals.find((goal) => goal.id === goalId);
  if (!created) {
    throw new Error("Failed to create goal");
  }
  return created;
}

export async function updateGoal(
  userId: string,
  goalId: string,
  input: Partial<Omit<Goal, "id">>,
): Promise<Goal | null> {
  const db = getDb();
  const existing = await db.query.goals.findFirst({
    where: eq(goalsTable.id, goalId),
  });

  if (!existing || existing.userId !== userId) {
    return null;
  }

  const now = new Date().toISOString();
  await db
    .update(goalsTable)
    .set({
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      totalMinutes: input.totalMinutes ?? existing.totalMinutes,
      deadline: input.deadline ?? existing.deadline,
      chunkMinutes: input.chunkMinutes ?? existing.chunkMinutes,
      priority: input.priority ?? existing.priority,
      updatedAt: now,
    })
    .where(eq(goalsTable.id, goalId));

  if (input.subtasks) {
    await db.delete(subtasksTable).where(eq(subtasksTable.goalId, goalId));
    if (input.subtasks.length > 0) {
      await db.insert(subtasksTable).values(
        input.subtasks.map((subtask, index) => ({
          id: subtask.id || createId(),
          goalId,
          title: subtask.title,
          estimatedMinutes: subtask.estimatedMinutes,
          completed: subtask.completed,
          sortOrder: index,
        })),
      );
    }
  }

  const goals = await loadGoalsWithSubtasks(userId);
  return goals.find((goal) => goal.id === goalId) ?? null;
}

export async function deleteGoal(userId: string, goalId: string): Promise<boolean> {
  const db = getDb();
  const existing = await db.query.goals.findFirst({
    where: eq(goalsTable.id, goalId),
  });

  if (!existing || existing.userId !== userId) {
    return false;
  }

  await db.delete(subtasksTable).where(eq(subtasksTable.goalId, goalId));
  await db.delete(goalsTable).where(eq(goalsTable.id, goalId));
  return true;
}
