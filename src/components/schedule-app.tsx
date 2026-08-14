"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleCalendarPanel } from "@/components/google-calendar-panel";
import { GoogleConnect } from "@/components/google-connect";
import { GoalForm } from "@/components/goal-form";
import { HabitForm } from "@/components/habit-form";
import { ScheduleTimeline } from "@/components/schedule-timeline";
import { WeekCalendar } from "@/components/week-calendar";
import {
  createDemoGoals,
  createDemoGoogleEvents,
  createDemoHabits,
} from "@/lib/demo-data";
import { toTimelineEvents } from "@/lib/scheduler";
import {
  loadGoals,
  loadHabits,
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

const AUTH_MESSAGES: Record<string, string> = {
  connected: "Googleカレンダーに接続しました。予定を取得しています…",
  error: "Googleカレンダーへの接続がキャンセルされました",
  failed: "Googleカレンダーへの接続に失敗しました",
  invalid_state: "認証セッションが無効です。もう一度お試しください",
  missing: "認証情報が不足しています",
};

function readAuthMessage(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const auth = params.get("auth");
  if (!auth || !AUTH_MESSAGES[auth]) {
    return null;
  }

  window.history.replaceState({}, "", window.location.pathname);
  return AUTH_MESSAGES[auth];
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
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(() => {
    const authMessage = readAuthMessage();
    if (authMessage) {
      return authMessage;
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

  const fetchGoogleEvents = useCallback(async () => {
    const params = new URLSearchParams({
      timeMin: rangeStart,
      timeMax: rangeEnd,
    });
    const response = await fetch(`/api/calendar/events?${params.toString()}`);
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? "Google Calendar の取得に失敗しました");
    }
    const data = (await response.json()) as { events: CalendarEvent[] };
    setGoogleEvents(data.events);
    setUseDemoEvents(false);
    window.localStorage.setItem(DEMO_EVENTS_KEY, "0");
    return data.events;
  }, [rangeEnd, rangeStart]);

  const syncCalendar = useCallback(async () => {
    if (!connected) {
      setMessage("Googleカレンダーに接続してください");
      return;
    }

    setSyncing(true);
    setMessage(null);

    try {
      const events = await fetchGoogleEvents();
      setMessage(`Googleカレンダーから ${events.length} 件の予定を取得しました`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "同期に失敗しました");
    } finally {
      setSyncing(false);
    }
  }, [connected, fetchGoogleEvents]);

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

  const timelineEvents = useMemo(
    () => toTimelineEvents(googleEvents, scheduled),
    [googleEvents, scheduled],
  );

  async function generateSchedule() {
    setLoading(true);
    setMessage(null);

    try {
      let events: CalendarEvent[] = googleEvents;

      if (connected) {
        events = await fetchGoogleEvents();
      } else if (useDemoEvents) {
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
          habits,
          goals,
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
        `スケジュールを生成しました（Google ${events.length} 件 / 配置 ${data.scheduled.length} 件 / 未配置 ${data.unscheduled.length} 件）`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  async function pushToGoogleCalendar() {
    if (!connected) {
      setMessage("Googleカレンダーに接続してください");
      return;
    }

    const generated = scheduled.filter((block) => block.kind !== "google");
    if (generated.length === 0) {
      setMessage("反映する予定がありません。先にスケジュールを生成してください。");
      return;
    }

    setPushing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/calendar/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: generated.map((block) => ({
            title: `[予定] ${block.title}`,
            start: block.start,
            end: block.end,
            description: "yotei アプリから自動生成",
          })),
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Google Calendar への反映に失敗しました");
      }

      const data = (await response.json()) as { createdCount: number };
      setMessage(`Googleカレンダーに ${data.createdCount} 件反映しました`);
      await fetchGoogleEvents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "エラーが発生しました");
    } finally {
      setPushing(false);
    }
  }

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
          Googleカレンダーの予定と、生活習慣・分割タスクをもとに、2週間分のスケジュールを自動生成します。
        </p>
      </header>

      <div className="mb-6 space-y-4">
        <GoogleConnect
          connected={connected}
          configured={configured}
          eventCount={googleEvents.length}
          redirectUri={redirectUri}
          syncing={syncing}
          onSync={() => {
            void syncCalendar();
          }}
          onStatusChange={() => {
            void refreshAuthStatus().then(async (status) => {
              if (status.connected) {
                await syncCalendar();
              } else {
                setGoogleEvents([]);
              }
            });
          }}
        />

        {connected ? (
          <GoogleCalendarPanel
            events={googleEvents}
            loading={syncing}
            onRefresh={() => {
              void syncCalendar();
            }}
          />
        ) : null}

        <section className="panel p-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={loading}
              onClick={() => {
                void generateSchedule();
              }}
            >
              {loading ? "生成中..." : "スケジュールを生成"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={pushing || !connected}
              onClick={() => {
                void pushToGoogleCalendar();
              }}
            >
              {pushing ? "反映中..." : "Googleカレンダーに反映"}
            </button>
            <button type="button" className="btn-secondary" onClick={loadDemoData}>
              デモデータ
            </button>
          </div>

          {!connected ? (
            <label className="mt-4 flex items-center gap-2 text-sm text-[var(--muted)]">
              <input
                type="checkbox"
                checked={useDemoEvents}
                onChange={(event) => toggleDemoEvents(event.target.checked)}
              />
              Google未接続時はサンプルの既存予定を使う
            </label>
          ) : null}

          {message ? <p className="mt-3 text-sm text-[var(--muted)]">{message}</p> : null}
        </section>
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
