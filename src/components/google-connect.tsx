"use client";

import { GoogleSetupGuide } from "@/components/google-setup-guide";

type GoogleConnectProps = {
  connected: boolean;
  configured: boolean;
  eventCount: number;
  redirectUri: string;
  autoSync: boolean;
  syncing: boolean;
  onStatusChange: () => void;
};

export function GoogleConnect({
  connected,
  configured,
  eventCount,
  redirectUri,
  autoSync,
  syncing,
  onStatusChange,
}: GoogleConnectProps) {
  async function disconnect() {
    await fetch("/api/auth/logout", { method: "POST" });
    onStatusChange();
  }

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Googleカレンダー</h2>
          <p className="text-sm text-[var(--muted)]">
            接続するだけで、予定の取得・生成・反映が自動で動きます。
          </p>
          {connected ? (
            <p className="mt-1 text-xs text-[var(--teal-deep)]">
              連携中 · 予定 {eventCount} 件
              {autoSync ? " · 自動同期 ON" : " · 手動モード"}
              {syncing ? " · 同期中..." : ""}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {!configured ? (
            <span className="chip">OAuth 未設定</span>
          ) : connected ? (
            <>
              <span className="chip">接続済み</span>
              <button type="button" className="btn-secondary text-sm" onClick={disconnect}>
                切断
              </button>
            </>
          ) : (
            <a href="/api/auth/google" className="btn-primary text-sm no-underline">
              Googleで接続（自動同期開始）
            </a>
          )}
        </div>
      </div>

      {!configured ? <GoogleSetupGuide redirectUri={redirectUri} /> : null}
    </section>
  );
}
