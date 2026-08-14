"use client";

import { formatDateTime } from "@/lib/storage";
import type { CalendarEvent } from "@/lib/types";

type GoogleCalendarPanelProps = {
  events: CalendarEvent[];
  loading: boolean;
  onRefresh: () => void;
};

export function GoogleCalendarPanel({
  events,
  loading,
  onRefresh,
}: GoogleCalendarPanelProps) {
  return (
    <section className="panel p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Googleカレンダーの予定</h2>
          <p className="text-sm text-[var(--muted)]">
            連携中のカレンダーから {events.length} 件読み込み済み
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={loading}
          onClick={onRefresh}
        >
          {loading ? "取得中..." : "再取得"}
        </button>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          この期間に Google カレンダーの予定はありません。
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.id} className="event-card event-google">
              <p className="font-medium">{event.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {formatDateTime(event.start)} 〜 {formatDateTime(event.end)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
