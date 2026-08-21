"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleCalendarPanel } from "@/components/google-calendar-panel";
import { GoogleConnect } from "@/components/google-connect";
import { GoalForm } from "@/components/goal-form";
import { HabitForm } from "@/components/habit-form";
import { ScheduleTimeline } from "@/components/schedule-timeline";
import { SyncStatus } from "@/components/sync-status";
import { useGoogleTokenRefresh } from "@/components/google-sign-in-button";
import { WeekCalendar } from "@/components/week-calendar";
import { createDemoGoogleEvents } from "@/lib/demo-data";
import { toTimelineEvents } from "@/lib/scheduler";
import {
  fetchUserData,
  migrateLegacyStorageIfNeeded,
  persistGoals,
  persistHabits,
  persistPreferences,
  seedDemoData,
} from "@/lib/storage";
import type {
  CalendarEvent,
  GenerateScheduleResponse,
  Goal,
  Habit,
  ScheduledBlock,
} from "@/lib/types";

const AUTO_SYNC_DEBOUNCE_MS = 1500;
const SAVE_DEBOUNCE_MS = 800;

type SyncResponse = {
  googleEvents: CalendarEvent[];
  scheduled: ScheduledBlock[];
  unscheduled: GenerateScheduleResponse["unscheduled"];
  pushed: { created: number; updated: number };
  syncedAt: string;
};

type ScheduleAppProps = {
  initialConnected: boolean;
  initialConfigured: boolean;
  initialGoogleEvents: CalendarEvent[];
  initialHabits: Habit[];
  initialGoals: Goal[];
  initialAutoSync: boolean;
  initialUseDemoEvents: boolean;
  initialLastSyncedAt: string | null;
  googleClientId: string;
  rangeStart: string;
  rangeEnd: string;
};

export function ScheduleApp({
  initialConnected,
  initialConfigured,
  initialGoogleEvents,
  initialHabits,
  initialGoals,
  initialAutoSync,
  initialUseDemoEvents,
  initialLastSyncedAt,
  googleClientId,
  rangeStart,
  rangeEnd,
}: ScheduleAppProps) {
  const [habits, setHabits] = useState<Habit[]>(initialHabits);
  const [goals, setGoals] = useState<Goal[]>(initialGoals);
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>(initialGoogleEvents);
  const [scheduled, setScheduled] = useState<ScheduledBlock[]>([]);
  const [unscheduled, setUnscheduled] = useState<
    GenerateScheduleResponse["unscheduled"]
  >([]);
  const [connected, setConnected] = useState(initialConnected);
  const [configured, setConfigured] = useState(initialConfigured);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoSync, setAutoSync] = useState(initialAutoSync);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(initialLastSyncedAt);
  const [message, setMessage] = useState<string | null>(() => {
    if (initialGoogleEvents.length > 0) {
      return `Googleカレンダーから ${initialGoogleEvents.length} 件の予定を読み込みました`;
    }
    return null;
  });
  const [useDemoEvents, setUseDemoEvents] = useState(initialUseDemoEvents);
  const [hydrated, setHydrated] = useState(false);

  const habitsRef = useRef(habits);
  const goalsRef = useRef(goals);
  const connectedRef = useRef(connected);
  const autoSyncRef = useRef(autoSync);
  const initialSyncDoneRef = useRef(false);
  const pendingConnectSyncRef = useRef(false);

  useEffect(() => {
    habitsRef.current = habits;
    goalsRef.current = goals;
    connectedRef.current = connected;
    autoSyncRef.current = autoSync;
  }, [habits, goals, connected, autoSync]);

  const { refreshSilently } = useGoogleTokenRefresh(googleClientId, connected);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const migrated = await migrateLegacyStorageIfNeeded();
        if (migrated) {
          const data = await fetchUserData();
          if (!cancelled) {
            setHabits(data.habits);
            setGoals(data.goals);
            setAutoSync(data.preferences.autoSync);
            setUseDemoEvents(data.preferences.useDemoEvents);
            setMessage("ローカルデータをサーバーに移行しました");
          }
        }
      } catch {
        if (!cancelled) {
          setMessage("サーバーへの接続に失敗しました。ページを再読み込みしてください。");
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
      let response = await fetch("/api/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rangeStart,
          rangeEnd,
          pushToGoogle: true,
          useStoredData: true,
        }),
      });

      if (response.status === 401) {
        const refreshed = await refreshSilently();
        if (refreshed) {
          response = await fetch("/api/calendar/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rangeStart,
              rangeEnd,
              pushToGoogle: true,
              useStoredData: true,
            }),
          });
        }
      }

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
      void persistPreferences({ useDemoEvents: false });
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
  }, [rangeEnd, rangeStart, refreshSilently]);

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
          googleEvents: events,
          rangeStart,
          rangeEnd,
          useStoredData: true,
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
    if (!hydrated) {
      return;
    }

    const timer = window.setTimeout(() => {
      void persistHabits(habits).catch(() => {
        setMessage("習慣の保存に失敗しました");
      });
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [habits, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const timer = window.setTimeout(() => {
      void persistGoals(goals).catch(() => {
        setMessage("ゴールの保存に失敗しました");
      });
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [goals, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void persistPreferences({ autoSync }).catch(() => {
      setMessage("設定の保存に失敗しました");
    });
  }, [autoSync, hydrated]);

  useEffect(() => {
    if (!connected || !autoSync || !hydrated) {
      return;
    }

    const delay = !initialSyncDoneRef.current
      ? pendingConnectSyncRef.current
        ? 0
        : 300
      : AUTO_SYNC_DEBOUNCE_MS;

    initialSyncDoneRef.current = true;
    pendingConnectSyncRef.current = false;

    const timer = window.setTimeout(() => {
      void runSyncRef.current();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [connected, autoSync, habits, goals, hydrated]);

  const handleConnected = useCallback(() => {
    pendingConnectSyncRef.current = true;
    initialSyncDoneRef.current = false;
    setConnected(true);
    setMessage("Googleカレンダーに接続しました。自動同期を開始します…");
    void refreshAuthStatus();
  }, [refreshAuthStatus]);

  const handleDisconnect = useCallback(() => {
    void fetch("/api/auth/logout", { method: "POST" }).then(() => {
      setConnected(false);
      setGoogleEvents([]);
      setScheduled([]);
      setUnscheduled([]);
      setMessage("Googleカレンダーとの連携を解除しました");
    });
  }, []);

  const timelineEvents = useMemo(() => {
    if (connected) {
      return [...googleEvents].sort(
        (left, right) =>
          new Date(left.start).getTime() - new Date(right.start).getTime(),
      );
    }

    return toTimelineEvents(googleEvents, scheduled);
  }, [connected, googleEvents, scheduled]);

  async function loadDemoData() {
    try {
      const data = await seedDemoData();
      setHabits(data.habits);
      setGoals(data.goals);
      setUseDemoEvents(true);
      setMessage("デモデータを読み込みました");
    } catch {
      setMessage("デモデータの読み込みに失敗しました");
    }
  }

  function toggleDemoEvents(enabled: boolean) {
    setUseDemoEvents(enabled);
    void persistPreferences({ useDemoEvents: enabled });
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
          clientId={googleClientId}
          eventCount={googleEvents.length}
          autoSync={autoSync}
          syncing={syncing}
          onConnected={handleConnected}
          onDisconnect={handleDisconnect}
          onError={setMessage}
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
                {loading ? "生成中..." : "スケジュールを生成（オフライン）"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => {
                void loadDemoData();
              }}>
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
