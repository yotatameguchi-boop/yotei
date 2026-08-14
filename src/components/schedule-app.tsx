"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleCalendarPanel } from "@/components/google-calendar-panel";
import { GoogleConnect } from "@/components/google-connect";
import { GoalForm } from "@/components/goal-form";
import { HabitForm } from "@/components/habit-form";
import { ScheduleTimeline } from "@/components/schedule-timeline";
import { SyncStatus } from "@/components/sync-status";
import { WeekCalendar } from "@/components/week-calendar";
import {
  createDemoGoals,
  createDemoGoogleEvents,
  createDemoHabits,
} from "@/lib/demo-data";
import { toTimelineEvents } from "@/lib/scheduler";
import {
  loadAutoSync,
  loadGoals,
  loadHabits,
  saveAutoSync,
  saveGoals,
  saveHabits,
} from "@/lib/storage";
import type {
  CalendarEvent,
  GenerateScheduleResponse,
  Goal,
  Habit,
  ScheduledBlock,
} from "@/lib/types";

const INIT_KEY = "yotei-initialized";
const DEMO_EVENTS_KEY = "yotei-use-demo-events";
const AUTO_SYNC_DEBOUNCE_MS = 1500;

const AUTH_MESSAGES: Record<string, string> = {
  connected: "Googleカレンダーに接続しました。自動同期を開始します…",
  error: "Googleカレンダーへの接続がキャンセルされました",
  failed: "Googleカレンダーへの接続に失敗しました",
  invalid_state: "認証セッションが無効です。もう一度お試しください",
  missing: "認証情報が不足しています",
};

type SyncResponse = {
  googleEvents: CalendarEvent[];
  scheduled: ScheduledBlock[];
  unscheduled: GenerateScheduleResponse["unscheduled"];
  pushed: { created: number; updated: number };
  syncedAt: string;
};

function readAuthState(): { message: string | null; justConnected: boolean } {
  if (typeof window === "undefined") {
    return { message: null, justConnected: false };
  }

  const params = new URLSearchParams(window.location.search);
  const auth = params.get("auth");
  if (!auth || !AUTH_MESSAGES[auth]) {
    return { message: null, justConnected: false };
  }

  window.history.replaceState({}, "", window.location.pathname);
  return {
    message: AUTH_MESSAGES[auth],
    justConnected: auth === "connected",
  };
}

type ScheduleAppProps = {
  initialConnected: boolean;
  initialConfigured: boolean;
  initialGoogleEvents: CalendarEvent[];
  redirectUri: string;
  rangeStart: string;
  rangeEnd: string;
};

export function ScheduleApp({
  initialConnected,
  initialConfigured,
  initialGoogleEvents,
  redirectUri,
  rangeStart,
  rangeEnd,
}: ScheduleAppProps) {
  const [habits, setHabits] = useState<Habit[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const stored = loadHabits();
    const initialized = window.localStorage.getItem(INIT_KEY) === "1";
    if (!initialized && stored.length === 0) {
      window.localStorage.setItem(INIT_KEY, "1");
      window.localStorage.setItem(DEMO_EVENTS_KEY, "0");
      return createDemoHabits();
    }

    return stored;
  });
  const [goals, setGoals] = useState<Goal[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const stored = loadGoals();
    const initialized = window.localStorage.getItem(INIT_KEY) === "1";
    if (!initialized && stored.length === 0) {
      return createDemoGoals();
    }

    return stored;
  });
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>(initialGoogleEvents);
  const [scheduled, setScheduled] = useState<ScheduledBlock[]>([]);
  const [unscheduled, setUnscheduled] = useState<
    GenerateScheduleResponse["unscheduled"]
  >([]);
  const [connected, setConnected] = useState(initialConnected);
  const [configured, setConfigured] = useState(initialConfigured);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoSync, setAutoSync] = useState(loadAutoSync);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [boot] = useState(readAuthState);
  const [message, setMessage] = useState<string | null>(() => {
    if (boot.message) {
      return boot.message;
    }
    if (initialGoogleEvents.length > 0) {
      return `Googleカレンダーから ${initialGoogleEvents.length} 件の予定を読み込みました`;
    }
    return null;
  });
  const [useDemoEvents, setUseDemoEvents] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(DEMO_EVENTS_KEY) === "1";
  });

  const habitsRef = useRef(habits);
  const goalsRef = useRef(goals);
  const connectedRef = useRef(connected);
  const autoSyncRef = useRef(autoSync);
  const initialSyncDoneRef = useRef(false);

  useEffect(() => {
    habitsRef.current = habits;
    goalsRef.current = goals;
    connectedRef.current = connected;
    autoSyncRef.current = autoSync;
  }, [habits, goals, connected, autoSync]);

  const refreshAuthStatus = useCallback(async () => {
    const response = await fetch("/api/auth/status");
    const data = (await response.json()) as {
      connected: boolean;
      configured: boolean;
    };
    setConnected(data.connected);
    setConfigured(data.configured);
    return data;
  }, []);

  const runGoogleSync = useCallback(async (): Promise<SyncResponse | null> => {
    if (!connectedRef.current) {
      return null;
    }

    setSyncing(true);

    try {
      const response = await fetch("/api/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          habits: habitsRef.current,
          goals: goalsRef.current,
          rangeStart,
          rangeEnd,
          pushToGoogle: true,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "カレンダー同期に失敗しました");
      }

      const data = (await response.json()) as SyncResponse;
      setGoogleEvents(data.googleEvents);
      setScheduled(data.scheduled);
      setUnscheduled(data.unscheduled);
      setLastSyncedAt(data.syncedAt);
      setUseDemoEvents(false);
      window.localStorage.setItem(DEMO_EVENTS_KEY, "0");
      setMessage(
        `自動同期完了（Google ${data.googleEvents.length} 件 / 配置 ${data.scheduled.length} 件 / 新規 ${data.pushed.created}・更新 ${data.pushed.updated}）`,
      );
      return data;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "同期に失敗しました");
      return null;
    } finally {
      setSyncing(false);
    }
  }, [rangeEnd, rangeStart]);

  const runLocalGenerate = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      let events: CalendarEvent[] = [];

      if (useDemoEvents) {
        events = createDemoGoogleEvents();
        setGoogleEvents(events);
      } else {
        events = [];
        setGoogleEvents([]);
      }

      const response = await fetch("/api/schedule/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          habits: habitsRef.current,
          goals: goalsRef.current,
          googleEvents: events,
          rangeStart,
          rangeEnd,
        }),
      });

      if (!response.ok) {
        throw new Error("スケジュール生成に失敗しました");
      }

      const data = (await response.json()) as GenerateScheduleResponse;
      setScheduled(data.scheduled);
      setUnscheduled(data.unscheduled);
      setMessage(
        `スケジュールを生成しました（配置 ${data.scheduled.length} 件 / 未配置 ${data.unscheduled.length} 件）`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [rangeEnd, rangeStart, useDemoEvents]);

  const runSyncRef = useRef(runGoogleSync);
  useEffect(() => {
    runSyncRef.current = runGoogleSync;
  }, [runGoogleSync]);

  useEffect(() => {
    if (habits.length > 0 || window.localStorage.getItem(INIT_KEY) === "1") {
      saveHabits(habits);
    }
  }, [habits]);

  useEffect(() => {
    if (goals.length > 0 || window.localStorage.getItem(INIT_KEY) === "1") {
      saveGoals(goals);
    }
  }, [goals]);

  useEffect(() => {
    saveAutoSync(autoSync);
  }, [autoSync]);

  useEffect(() => {
    if (!connected || !autoSync) {
      return;
    }

    const delay =
      !initialSyncDoneRef.current && boot.justConnected
        ? 0
        : initialSyncDoneRef.current
          ? AUTO_SYNC_DEBOUNCE_MS
          : 300;

    initialSyncDoneRef.current = true;

    const timer = window.setTimeout(() => {
      void runSyncRef.current();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [boot.justConnected, connected, autoSync, habits, goals]);

  const timelineEvents = useMemo(() => {
    if (connected) {
      return [...googleEvents].sort(
        (left, right) =>
          new Date(left.start).getTime() - new Date(right.start).getTime(),
      );
    }

    return toTimelineEvents(googleEvents, scheduled);
  }, [connected, googleEvents, scheduled]);

  function loadDemoData() {
    setHabits(createDemoHabits());
    setGoals(createDemoGoals());
    setUseDemoEvents(true);
    window.localStorage.setItem(DEMO_EVENTS_KEY, "1");
    setMessage("デモデータを読み込みました");
  }

  function toggleDemoEvents(enabled: boolean) {
    setUseDemoEvents(enabled);
    window.localStorage.setItem(DEMO_EVENTS_KEY, enabled ? "1" : "0");
    if (!enabled && !connected) {
      setGoogleEvents([]);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-8">
        <p className="text-sm font-medium text-[var(--teal-deep)]">Schedule Planner</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">予定</h1>
        <p className="mt-3 max-w-3xl text-[var(--muted)]">
          Googleカレンダーと連携し、生活習慣・タスクを自動で読み込み・生成・反映します。
        </p>
      </header>

      <div className="mb-6 space-y-4">
        <GoogleConnect
          connected={connected}
          configured={configured}
          eventCount={googleEvents.length}
          redirectUri={redirectUri}
          autoSync={autoSync}
          syncing={syncing}
          onStatusChange={() => {
            void refreshAuthStatus().then(async (status) => {
              if (status.connected) {
                initialSyncDoneRef.current = false;
                if (autoSyncRef.current) {
                  await runSyncRef.current();
                }
              } else {
                setGoogleEvents([]);
                setScheduled([]);
                setUnscheduled([]);
              }
            });
          }}
        />

        <SyncStatus
          connected={connected}
          autoSync={autoSync}
          syncing={syncing}
          lastSyncedAt={lastSyncedAt}
          onAutoSyncChange={setAutoSync}
          onManualSync={() => {
            void runGoogleSync();
          }}
        />

        {connected ? (
          <GoogleCalendarPanel
            events={googleEvents.filter((event) => event.source === "google")}
            loading={syncing}
            onRefresh={() => {
              void runGoogleSync();
            }}
          />
        ) : null}

        {!connected ? (
          <section className="panel p-5">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-primary"
                disabled={loading}
                onClick={() => {
                  void runLocalGenerate();
                }}
              >
                {loading ? "生成中..." : "スケジュールを生成"}
              </button>
              <button type="button" className="btn-secondary" onClick={loadDemoData}>
                デモデータ
              </button>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-[var(--muted)]">
              <input
                type="checkbox"
                checked={useDemoEvents}
                onChange={(event) => toggleDemoEvents(event.target.checked)}
              />
              サンプルの既存予定を使う
            </label>
          </section>
        ) : null}

        {message ? (
          <p className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm text-[var(--muted)]">
            {message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <HabitForm habits={habits} onChange={setHabits} />
          <GoalForm goals={goals} onChange={setGoals} />
        </div>

        <div className="space-y-6">
          <ScheduleTimeline events={timelineEvents} unscheduled={unscheduled} />
          <WeekCalendar events={timelineEvents} rangeStart={rangeStart} />
        </div>
      </div>
    </main>
  );
}
