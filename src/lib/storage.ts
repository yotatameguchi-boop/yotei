import type { Goal, Habit } from "./types";
import {
  createDemoGoals,
  createDemoHabits,
} from "./demo-data";

const HABITS_KEY = "yotei-habits";
const GOALS_KEY = "yotei-goals";
const AUTO_SYNC_KEY = "yotei-auto-sync";
const INIT_KEY = "yotei-initialized";
const DEMO_EVENTS_KEY = "yotei-use-demo-events";

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

export function loadLegacyPreferences() {
  if (typeof window === "undefined") {
    return {
      initialized: false,
      useDemoEvents: false,
      autoSync: true,
    };
  }

  return {
    initialized: window.localStorage.getItem(INIT_KEY) === "1",
    useDemoEvents: window.localStorage.getItem(DEMO_EVENTS_KEY) === "1",
    autoSync: loadAutoSync(),
  };
}

export function clearLegacyStorage() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(HABITS_KEY);
  window.localStorage.removeItem(GOALS_KEY);
  window.localStorage.removeItem(AUTO_SYNC_KEY);
  window.localStorage.removeItem(INIT_KEY);
  window.localStorage.removeItem(DEMO_EVENTS_KEY);
}

export async function migrateLegacyStorageIfNeeded(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  const legacyHabits = loadHabits();
  const legacyGoals = loadGoals();
  const legacyPrefs = loadLegacyPreferences();

  if (
    legacyHabits.length === 0 &&
    legacyGoals.length === 0 &&
    !legacyPrefs.initialized
  ) {
    return false;
  }

  await fetch("/api/habits", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ habits: legacyHabits }),
  });

  await fetch("/api/goals", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goals: legacyGoals }),
  });

  await fetch("/api/user/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      autoSync: legacyPrefs.autoSync,
      initialized: legacyPrefs.initialized || legacyHabits.length > 0 || legacyGoals.length > 0,
      useDemoEvents: legacyPrefs.useDemoEvents,
    }),
  });

  clearLegacyStorage();
  return true;
}

export async function fetchUserData(): Promise<{
  habits: Habit[];
  goals: Goal[];
  preferences: {
    autoSync: boolean;
    initialized: boolean;
    useDemoEvents: boolean;
  };
}> {
  await migrateLegacyStorageIfNeeded();

  const [habitsRes, goalsRes, prefsRes] = await Promise.all([
    fetch("/api/habits"),
    fetch("/api/goals"),
    fetch("/api/user/preferences"),
  ]);

  if (!habitsRes.ok || !goalsRes.ok || !prefsRes.ok) {
    throw new Error("Failed to load user data");
  }

  const habitsData = (await habitsRes.json()) as { habits: Habit[] };
  const goalsData = (await goalsRes.json()) as { goals: Goal[] };
  const prefsData = (await prefsRes.json()) as {
    preferences: {
      autoSync: boolean;
      initialized: boolean;
      useDemoEvents: boolean;
    };
  };

  return {
    habits: habitsData.habits,
    goals: goalsData.goals,
    preferences: prefsData.preferences,
  };
}

export async function persistHabits(habits: Habit[]) {
  const response = await fetch("/api/habits", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ habits }),
  });

  if (!response.ok) {
    throw new Error("Failed to save habits");
  }
}

export async function persistGoals(goals: Goal[]) {
  const response = await fetch("/api/goals", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goals }),
  });

  if (!response.ok) {
    throw new Error("Failed to save goals");
  }
}

export async function persistPreferences(input: {
  autoSync?: boolean;
  initialized?: boolean;
  useDemoEvents?: boolean;
}) {
  const response = await fetch("/api/user/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Failed to save preferences");
  }
}

export async function seedDemoData() {
  const habits = createDemoHabits();
  const goals = createDemoGoals();

  await persistHabits(habits);
  await persistGoals(goals);
  await persistPreferences({
    initialized: true,
    useDemoEvents: true,
  });

  return { habits, goals };
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
