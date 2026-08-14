import type { CalendarEvent, GenerateScheduleResponse, Goal, Habit } from "./types";
import { generateSchedule } from "./scheduler";
import { ensureGoalSubtasks } from "./task-splitter";

export type SyncCalendarRequest = {
  habits: Habit[];
  goals: Goal[];
  rangeStart: string;
  rangeEnd: string;
  pushToGoogle?: boolean;
};

export type SyncCalendarResponse = {
  googleEvents: CalendarEvent[];
  scheduled: GenerateScheduleResponse["scheduled"];
  unscheduled: GenerateScheduleResponse["unscheduled"];
  pushed: { created: number; updated: number };
  syncedAt: string;
};

export function buildScheduleInput(input: SyncCalendarRequest) {
  return {
    habits: input.habits ?? [],
    goals: ensureGoalSubtasks(input.goals ?? []),
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
  };
}

export function generateFromInput(
  input: SyncCalendarRequest,
  googleEvents: SyncCalendarResponse["googleEvents"],
) {
  return generateSchedule({
    ...buildScheduleInput(input),
    googleEvents,
  });
}
