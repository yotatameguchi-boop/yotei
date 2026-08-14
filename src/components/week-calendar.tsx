"use client";

import { groupEventsByDay } from "@/lib/scheduler";
import { formatDateTime } from "@/lib/storage";
import type { CalendarEvent } from "@/lib/types";

type WeekCalendarProps = {
  events: CalendarEvent[];
  rangeStart: string;
};

function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayHeader(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function eventClass(source: CalendarEvent["source"]): string {
  if (source === "google") {
    return "event-google";
  }
  if (source === "habit") {
    return "event-habit";
  }
  return "event-task";
}

export function WeekCalendar({ events, rangeStart }: WeekCalendarProps) {
  const grouped = groupEventsByDay(events);
  const start = new Date(rangeStart);
  const days: Date[] = [];

  for (let index = 0; index < 7; index += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    days.push(day);
  }

  return (
    <section className="panel p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold">週間カレンダー</h2>
        <p className="text-sm text-[var(--muted)]">最初の7日間を日別に表示します。</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {days.map((day) => {
          const key = localDayKey(day);
          const dayEvents = grouped.get(key) ?? [];

          return (
            <div
              key={key}
              className="rounded-2xl border border-[var(--line)] bg-white/70 p-4"
            >
              <h3 className="mb-3 font-semibold">{formatDayHeader(day)}</h3>

              {dayEvents.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">予定なし</p>
              ) : (
                <ul className="space-y-2">
                  {dayEvents.map((event) => (
                    <li key={event.id} className={`event-card ${eventClass(event.source)}`}>
                      <p className="text-sm font-medium">{event.title}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatDateTime(event.start)} – {formatDateTime(event.end)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
