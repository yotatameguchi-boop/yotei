"use client";

type GoogleSetupGuideProps = {
  redirectUri: string;
};

export function GoogleSetupGuide({ redirectUri }: GoogleSetupGuideProps) {
  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
      <h3 className="font-semibold">Googleカレンダー連携の設定</h3>
      <p className="mt-2 text-amber-900/80">
        OAuth 認証情報を <code className="rounded bg-white/70 px-1">.env.local</code>{" "}
        に設定すると、カレンダーの読み込み・反映が使えるようになります。
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-amber-900/80">
        <li>
          <a
            className="font-medium underline"
            href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"
            target="_blank"
            rel="noreferrer"
          >
            Google Calendar API
          </a>
          {" "}を有効化
        </li>
        <li>
          <a
            className="font-medium underline"
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noreferrer"
          >
            OAuth 2.0 クライアント ID
          </a>
          {" "}（Web アプリ）を作成
        </li>
        <li>
          承認済みリダイレクト URI に{" "}
          <code className="rounded bg-white/70 px-1">{redirectUri}</code> を追加
        </li>
        <li>
          クライアント ID / シークレットを <code className="rounded bg-white/70 px-1">.env.local</code>{" "}
          に設定し、開発サーバーを再起動
        </li>
      </ol>
      <p className="mt-3 text-xs text-amber-900/70">
        ターミナルで <code className="rounded bg-white/70 px-1">npm run setup</code>{" "}
        を実行すると対話形式で設定できます。
      </p>
    </div>
  );
}
