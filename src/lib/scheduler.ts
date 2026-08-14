import type {
  CalendarEvent,
  GenerateScheduleRequest,
  GenerateScheduleResponse,
  Habit,
  ScheduledBlock,
  TimeOfDay,
  TimeRange,
} from "./types";
import { createId } from "./types";
import { pendingSubtasks } from "./task-splitter";

const TIME_WINDOWS: Record<Exclude<TimeOfDay, "any">, [number, number]> = {
  morning: [7, 12],
  afternoon: [12, 17],
  evening: [17, 22],
};

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function cloneDate(date: Date): Date {
  return new Date(date.getTime());
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function setTime(date: Date, hour: number, minute = 0): Date {
  const next = cloneDate(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

function mergeBusyRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length === 0) {
    return [];
  }

  const sorted = [...ranges].sort(
    (left, right) => left.start.getTime() - right.start.getTime(),
  );
  const merged: TimeRange[] = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function subtractBusyFromWindow(window: TimeRange, busy: TimeRange[]): TimeRange[] {
  let free: TimeRange[] = [window];

  for (const block of busy) {
    const nextFree: TimeRange[] = [];

    for (const slot of free) {
      if (!overlaps(slot, block)) {
        nextFree.push(slot);
        continue;
      }

      if (block.start > slot.start) {
        nextFree.push({ start: slot.start, end: block.start });
      }

      if (block.end < slot.end) {
        nextFree.push({ start: block.end, end: slot.end });
      }
    }

    free = nextFree;
  }

  return free.filter(
    (slot) => slot.end.getTime() - slot.start.getTime() >= 15 * 60_000,
  );
}

function getDayBounds(
  day: Date,
  dayStartHour: number,
  dayEndHour: number,
): TimeRange {
  return {
    start: setTime(day, dayStartHour),
    end: setTime(day, dayEndHour),
  };
}

function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = setTime(start, 0);

  while (cursor <= end) {
    days.push(cloneDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function intersectWindow(slot: TimeRange, window: TimeRange): TimeRange | null {
  const start = new Date(Math.max(slot.start.getTime(), window.start.getTime()));
  const end = new Date(Math.min(slot.end.getTime(), window.end.getTime()));

  if (end.getTime() - start.getTime() < 15 * 60_000) {
    return null;
  }

  return { start, end };
}

function preferredWindow(
  day: Date,
  preferredTime: TimeOfDay,
  dayStartHour: number,
  dayEndHour: number,
): TimeRange {
  if (preferredTime === "any") {
    return getDayBounds(day, dayStartHour, dayEndHour);
  }

  const [startHour, endHour] = TIME_WINDOWS[preferredTime];
  return {
    start: setTime(day, Math.max(startHour, dayStartHour)),
    end: setTime(day, Math.min(endHour, dayEndHour)),
  };
}

function slotScore(slot: TimeRange, preferredTime: TimeOfDay): number {
  if (preferredTime === "any") {
    return 0;
  }

  const hour = slot.start.getHours();
  const [startHour, endHour] = TIME_WINDOWS[preferredTime];
  return hour >= startHour && hour < endHour ? 0 : 100;
}

function takeSlot(
  slots: TimeRange[],
  durationMinutes: number,
  preferredTime: TimeOfDay,
): TimeRange | null {
  const ranked = slots
    .map((slot, index) => ({
      slot,
      index,
      score: slotScore(slot, preferredTime),
      size: slot.end.getTime() - slot.start.getTime(),
    }))
    .filter((entry) => entry.size >= durationMinutes * 60_000)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }
      return left.slot.start.getTime() - right.slot.start.getTime();
    });

  if (ranked.length === 0) {
    return null;
  }

  const chosen = ranked[0];
  const used: TimeRange = {
    start: chosen.slot.start,
    end: addMinutes(chosen.slot.start, durationMinutes),
  };

  const remaining: TimeRange[] = [];
  if (used.end < chosen.slot.end) {
    remaining.push({ start: used.end, end: chosen.slot.end });
  }

  slots.splice(chosen.index, 1, ...remaining);
  return used;
}

function weekdayIndex(day: Date): number {
  const jsDay = day.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function habitMatchesDay(habit: Habit, day: Date): boolean {
  return habit.days.includes(WEEKDAYS[weekdayIndex(day)]);
}

class DaySlotManager {
  private readonly googleBusy: TimeRange[];
  private readonly scheduledBusy: TimeRange[] = [];
  private readonly freeByDay = new Map<string, TimeRange[]>();

  constructor(
    private readonly dayStartHour: number,
    private readonly dayEndHour: number,
    googleEvents: CalendarEvent[],
    days: Date[],
  ) {
    this.googleBusy = mergeBusyRanges(
      googleEvents.map((event) => ({
        start: new Date(event.start),
        end: new Date(event.end),
      })),
    );

    for (const day of days) {
      this.rebuildDay(day);
    }
  }

  private allBusy(): TimeRange[] {
    return mergeBusyRanges([...this.googleBusy, ...this.scheduledBusy]);
  }

  private rebuildDay(day: Date) {
    this.freeByDay.set(
      localDayKey(day),
      subtractBusyFromWindow(
        getDayBounds(day, this.dayStartHour, this.dayEndHour),
        this.allBusy(),
      ),
    );
  }

  getSlots(day: Date): TimeRange[] {
    return [...(this.freeByDay.get(localDayKey(day)) ?? [])];
  }

  occupy(day: Date, used: TimeRange) {
    this.scheduledBusy.push(used);
    this.rebuildDay(day);
  }

  placeOnDay(
    day: Date,
    durationMinutes: number,
    preferredTime: TimeOfDay,
    window?: TimeRange,
    maxEnd?: Date,
  ): TimeRange | null {
    const slots = this.getSlots(day);
    const candidates = window
      ? slots
          .map((slot) => intersectWindow(slot, window))
          .filter((slot): slot is TimeRange => slot !== null)
      : slots;

    const used = takeSlot(candidates, durationMinutes, preferredTime);
    if (!used) {
      return null;
    }

    if (maxEnd && used.end > maxEnd) {
      return null;
    }

    this.occupy(day, used);
    return used;
  }
}

export function generateSchedule(
  input: GenerateScheduleRequest,
): GenerateScheduleResponse {
  const dayStartHour = input.dayStartHour ?? 7;
  const dayEndHour = input.dayEndHour ?? 23;
  const rangeStart = new Date(input.rangeStart);
  const rangeEnd = new Date(input.rangeEnd);
  const days = eachDay(rangeStart, rangeEnd);
  const slots = new DaySlotManager(
    dayStartHour,
    dayEndHour,
    input.googleEvents,
    days,
  );

  const scheduled: ScheduledBlock[] = [];
  const unscheduled: GenerateScheduleResponse["unscheduled"] = [];

  for (const day of days) {
    for (const habit of input.habits) {
      if (!habitMatchesDay(habit, day)) {
        continue;
      }

      const window = preferredWindow(day, habit.preferredTime, dayStartHour, dayEndHour);
      const used = slots.placeOnDay(day, habit.durationMinutes, habit.preferredTime, window);

      if (!used) {
        unscheduled.push({
          refId: habit.id,
          title: habit.name,
          remainingMinutes: habit.durationMinutes,
          reason: `${localDayKey(day)} に空き時間がありません`,
        });
        continue;
      }

      scheduled.push({
        id: createId(),
        title: habit.name,
        start: used.start.toISOString(),
        end: used.end.toISOString(),
        kind: "habit",
        refId: habit.id,
      });
    }
  }

  const sortedGoals = [...input.goals].sort(
    (left, right) =>
      new Date(left.deadline).getTime() - new Date(right.deadline).getTime() ||
      left.priority - right.priority,
  );

  for (const goal of sortedGoals) {
    const deadline = new Date(goal.deadline);

    for (const subtask of pendingSubtasks(goal)) {
      let placed = false;

      for (const day of days) {
        const dayEnd = setTime(day, dayEndHour);
        if (dayEnd > deadline) {
          break;
        }

        const used = slots.placeOnDay(
          day,
          subtask.estimatedMinutes,
          "any",
          undefined,
          deadline,
        );
        if (!used) {
          continue;
        }

        scheduled.push({
          id: createId(),
          title: subtask.title,
          start: used.start.toISOString(),
          end: used.end.toISOString(),
          kind: "task",
          refId: subtask.id,
        });
        placed = true;
        break;
      }

      if (!placed) {
        unscheduled.push({
          refId: subtask.id,
          title: subtask.title,
          remainingMinutes: subtask.estimatedMinutes,
          reason: "空き時間が見つかりませんでした",
        });
      }
    }
  }

  scheduled.sort(
    (left, right) =>
      new Date(left.start).getTime() - new Date(right.start).getTime(),
  );

  return { scheduled, unscheduled };
}

export function toTimelineEvents(
  googleEvents: CalendarEvent[],
  scheduled: ScheduledBlock[],
): CalendarEvent[] {
  const generated = scheduled.map((block) => ({
    id: block.id,
    title: block.title,
    start: block.start,
    end: block.end,
    source: block.kind,
    color:
      block.kind === "habit"
        ? "#6aabbf"
        : block.kind === "task"
          ? "#8ec4b0"
          : "#647880",
  }));

  return [...googleEvents, ...generated].sort(
    (left, right) =>
      new Date(left.start).getTime() - new Date(right.start).getTime(),
  );
}

export function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const key = localDayKey(new Date(event.start));
    const list = grouped.get(key) ?? [];
    list.push(event);
    grouped.set(key, list);
  }

  return grouped;
}
