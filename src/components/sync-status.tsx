"use client";

type SyncStatusProps = {
  syncing: boolean;
  autoSync: boolean;
  connected: boolean;
  lastSyncedAt: string | null;
  onAutoSyncChange: (enabled: boolean) => void;
  onManualSync: () => void;
};

function formatSyncedAt(value: string | null): string {
  if (!value) {
    return "未同期";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function SyncStatus({
  syncing,
  autoSync,
  connected,
  lastSyncedAt,
  onAutoSyncChange,
  onManualSync,
}: SyncStatusProps) {
  if (!connected) {
    return null;
  }

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">自動同期</h2>
          <p className="text-sm text-[var(--muted)]">
            カレンダー取得 → スケジュール生成 → Google反映まで自動で実行します。
          </p>
          <p className="mt-1 text-xs text-[var(--teal-deep)]">
            {syncing ? "同期中..." : `最終同期: ${formatSyncedAt(lastSyncedAt)}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(event) => onAutoSyncChange(event.target.checked)}
            />
            自動同期 ON
          </label>
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={syncing}
            onClick={onManualSync}
          >
            今すぐ同期
          </button>
        </div>
      </div>
    </section>
  );
}
