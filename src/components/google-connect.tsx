"use client";

import { GoogleSignInButton } from "@/components/google-sign-in-button";

type GoogleConnectProps = {
  connected: boolean;
  configured: boolean;
  clientId: string;
  eventCount: number;
  autoSync: boolean;
  syncing: boolean;
  onConnected: () => void;
  onDisconnect: () => void;
  onError: (message: string) => void;
};

export function GoogleConnect({
  connected,
  configured,
  clientId,
  eventCount,
  autoSync,
  syncing,
  onConnected,
  onDisconnect,
  onError,
}: GoogleConnectProps) {
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Googleカレンダー</h2>
          <p className="text-sm text-[var(--muted)]">
            ボタンを押すだけで、予定の取得・生成・反映まで自動で行います。
          </p>
          {connected ? (
            <p className="mt-1 text-xs text-[var(--teal-deep)]">
              連携中 · 予定 {eventCount} 件
              {autoSync ? " · 自動同期 ON" : ""}
              {syncing ? " · 同期中..." : ""}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {connected ? (
            <>
              <span className="chip">接続済み</span>
              <button type="button" className="btn-secondary text-sm" onClick={onDisconnect}>
                切断
              </button>
            </>
          ) : configured ? (
            <GoogleSignInButton
              clientId={clientId}
              onConnected={onConnected}
              onError={onError}
            />
          ) : (
            <p className="text-sm text-[var(--muted)]">
              カレンダー連携の準備中です。しばらくお待ちください。
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
