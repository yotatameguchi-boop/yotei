import type { Goal, Subtask } from "./types";
import { createId } from "./types";

export function splitGoalIntoSubtasks(goal: Goal): Subtask[] {
  if (goal.subtasks.length > 0) {
    return goal.subtasks;
  }

  const chunk = Math.max(15, goal.chunkMinutes);
  const count = Math.ceil(goal.totalMinutes / chunk);
  const subtasks: Subtask[] = [];

  for (let index = 0; index < count; index += 1) {
    const remaining = goal.totalMinutes - index * chunk;
    const minutes = Math.min(chunk, remaining);
    subtasks.push({
      id: createId(),
      title: `${goal.title} (${index + 1}/${count})`,
      estimatedMinutes: minutes,
      completed: false,
    });
  }

  return subtasks;
}

export function ensureGoalSubtasks(goals: Goal[]): Goal[] {
  return goals.map((goal) => ({
    ...goal,
    subtasks: splitGoalIntoSubtasks(goal),
  }));
}

export function pendingSubtasks(goal: Goal): Subtask[] {
  return splitGoalIntoSubtasks(goal).filter((subtask) => !subtask.completed);
}

export function totalPendingMinutes(goal: Goal): number {
  return pendingSubtasks(goal).reduce(
    (sum, subtask) => sum + subtask.estimatedMinutes,
    0,
  );
}
