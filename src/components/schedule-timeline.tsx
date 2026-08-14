"use client";

import { groupEventsByDay } from "@/lib/scheduler";
import { formatDateTime } from "@/lib/storage";
import type { CalendarEvent } from "@/lib/types";

type ScheduleTimelineProps = {
  events: CalendarEvent[];
  unscheduled: Array<{
    refId: string;
    title: string;
    remainingMinutes: number;
    reason: string;
  }>;
};

function eventClass(source: CalendarEvent["source"]): string {
  if (source === "google") {
    return "event-google";
  }
  if (source === "habit") {
    return "event-habit";
  }
  return "event-task";
}

function sourceLabel(source: CalendarEvent["source"]): string {
  if (source === "google") {
    return "Google";
  }
  if (source === "habit") {
    return "習慣";
  }
  return "タスク";
}

function formatDayLabel(isoDate: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(isoDate));
}

export function ScheduleTimeline({ events, unscheduled }: ScheduleTimelineProps) {
  const grouped = groupEventsByDay(events);
  const dayKeys = [...grouped.keys()].sort();

  return (
    <section className="panel p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold">生成されたスケジュール</h2>
        <p className="text-sm text-[var(--muted)]">
          Google予定・生活習慣・タスクを時系列で表示します。
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="chip">Google</span>
          <span className="chip" style={{ borderColor: "#6aabbf" }}>
            習慣
          </span>
          <span className="chip" style={{ borderColor: "#8ec4b0" }}>
            タスク
          </span>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          「スケジュールを生成」を押すと、ここに結果が表示されます。
        </p>
      ) : (
        <div className="space-y-5">
          {dayKeys.map((dayKey) => {
            const dayEvents = grouped.get(dayKey) ?? [];
            return (
              <div key={dayKey}>
                <h3 className="mb-2 text-sm font-semibold text-[var(--teal-deep)]">
                  {formatDayLabel(dayEvents[0]?.start ?? `${dayKey}T00:00:00`)}
                </h3>
                <div className="space-y-2">
                  {dayEvents.map((event) => (
                    <article
                      key={event.id}
                      className={`event-card ${eventClass(event.source)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-semibold">{event.title}</h4>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {formatDateTime(event.start)} 〜 {formatDateTime(event.end)}
                          </p>
                        </div>
                        <span className="chip">{sourceLabel(event.source)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {unscheduled.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <h3 className="font-semibold text-amber-900">未配置（{unscheduled.length}件）</h3>
          <ul className="mt-2 space-y-1 text-sm text-amber-900/80">
            {unscheduled.map((item) => (
              <li key={`${item.refId}-${item.title}`}>
                {item.title}（{item.remainingMinutes}分）— {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
