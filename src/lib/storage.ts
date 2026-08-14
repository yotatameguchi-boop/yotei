import type { Goal, Habit } from "./types";

const HABITS_KEY = "yotei-habits";
const GOALS_KEY = "yotei-goals";
const AUTO_SYNC_KEY = "yotei-auto-sync";

export function loadAutoSync(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const raw = window.localStorage.getItem(AUTO_SYNC_KEY);
  return raw === null ? true : raw === "1";
}

export function saveAutoSync(enabled: boolean) {
  window.localStorage.setItem(AUTO_SYNC_KEY, enabled ? "1" : "0");
}

export function loadHabits(): Habit[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(HABITS_KEY);
    return raw ? (JSON.parse(raw) as Habit[]) : [];
  } catch {
    return [];
  }
}

export function saveHabits(habits: Habit[]) {
  window.localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
}

export function loadGoals(): Goal[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(GOALS_KEY);
    return raw ? (JSON.parse(raw) as Goal[]) : [];
  } catch {
    return [];
  }
}

export function saveGoals(goals: Goal[]) {
  window.localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

export function defaultRange(): { start: string; end: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  end.setHours(23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDateInput(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}
