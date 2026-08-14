export type TimeOfDay = "morning" | "afternoon" | "evening" | "any";

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type Habit = {
  id: string;
  name: string;
  durationMinutes: number;
  preferredTime: TimeOfDay;
  days: DayOfWeek[];
};

export type Subtask = {
  id: string;
  title: string;
  estimatedMinutes: number;
  completed: boolean;
};

export type Goal = {
  id: string;
  title: string;
  description: string;
  totalMinutes: number;
  deadline: string;
  chunkMinutes: number;
  priority: number;
  subtasks: Subtask[];
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  source: "google" | "habit" | "task";
  color?: string;
};

export type ScheduledBlock = {
  id: string;
  title: string;
  start: string;
  end: string;
  kind: "google" | "habit" | "task";
  refId: string;
};

export type TimeRange = {
  start: Date;
  end: Date;
};

export type GenerateScheduleRequest = {
  habits: Habit[];
  goals: Goal[];
  googleEvents: CalendarEvent[];
  rangeStart: string;
  rangeEnd: string;
  dayStartHour?: number;
  dayEndHour?: number;
};

export type GenerateScheduleResponse = {
  scheduled: ScheduledBlock[];
  unscheduled: Array<{
    refId: string;
    title: string;
    remainingMinutes: number;
    reason: string;
  }>;
};

export type GoogleTokenPayload = {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
};

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "月",
  tuesday: "火",
  wednesday: "水",
  thursday: "木",
  friday: "金",
  saturday: "土",
  sunday: "日",
};

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: "朝 (7–12時)",
  afternoon: "昼 (12–17時)",
  evening: "夜 (17–22時)",
  any: "いつでも",
};

export const ALL_DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export function createId(): string {
  return crypto.randomUUID();
}
