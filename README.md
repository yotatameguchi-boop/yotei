# 予定 (yotei)

Googleカレンダーと連携したスケジュールアプリです。

PDF の要件に基づき、以下を実装しています。

- **Googleカレンダー連携** — OAuth で接続し、既存予定を読み込み、生成したスケジュールを反映
- **生活習慣** — 睡眠・食事・運動など、基礎ルーティンにかける時間を登録
- **タスク分割とゴール設定** — ゴールをセッション単位に自動分割し、空き時間へ配置

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

初回起動時はデモデータ（生活習慣・ゴール）が自動で読み込まれます。Google OAuth 未設定でも「サンプルの既存予定」を使ってスケジュール生成を試せます。

## Google OAuth 設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. **Google Calendar API** を有効化
3. **OAuth 2.0 クライアント ID**（Web アプリケーション）を作成
4. 承認済み JavaScript 生成元 に `http://localhost:3000` と本番 URL を追加
5. `.env.local` に以下を設定

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id
AUTH_SECRET=長いランダム文字列
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Client Secret は不要です（Google Identity Services のトークン方式）。

## バックエンド

習慣・ゴール・ユーザー設定・同期履歴は **サーバー側データベース** に保存されます。

| 保存先 | 内容 |
|--------|------|
| SQLite（ローカル） | `./data/yotei.db`（自動作成） |
| Turso（本番推奨） | `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` |
| httpOnly Cookie | ユーザーセッション、Google アクセストークン |

### API エンドポイント

| メソッド | パス | 説明 |
|----------|------|------|
| GET/PUT | `/api/habits` | 習慣の取得・一括保存 |
| GET/PUT | `/api/goals` | ゴールの取得・一括保存 |
| GET/PATCH | `/api/user/preferences` | 自動同期などの設定 |
| POST | `/api/calendar/sync` | Google 同期（DB から習慣・ゴールを読み込み） |
| POST | `/api/schedule/generate` | スケジュール生成 |
| GET | `/api/sync/history` | 同期履歴 |
| GET | `/api/auth/me` | ユーザー情報・統計 |

既存の localStorage データは初回アクセス時に自動でサーバーへ移行されます。

### 本番デプロイ（Vercel + Turso）

1. [Turso](https://turso.tech/) で DB を作成
2. Vercel の環境変数に `TURSO_DATABASE_URL` と `TURSO_AUTH_TOKEN` を設定
3. デプロイ

ローカルでは DB 設定なしで `./data/yotei.db` が使われます。

## 使い方

1. **Googleカレンダー** を接続（未設定でもデモモードで動作確認可能）
2. **生活習慣** を登録（「例を追加」で朝食・昼食・運動のテンプレートを追加可能）
3. **ゴールとタスク** を追加（総時間・期限・1セッション時間を指定すると自動分割）
4. **スケジュールを生成** — Google予定 → 習慣 → タスクの順で空き時間に配置
5. **Googleカレンダーに反映** — 生成した習慣・タスク予定をカレンダーへ書き込み

## 開発

```bash
npm run dev      # 開発サーバー
npm run build    # 本番ビルド
npm run lint     # ESLint
npm run test     # スケジューラのユニットテスト
npm run db:push  # Drizzle スキーマを DB に反映
```

## 技術スタック

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS 4
- Drizzle ORM + libSQL（SQLite / Turso）
- googleapis (Google Calendar API)

## スケジュール生成ロジック

1. Googleカレンダーの予定を「埋まっている時間」として扱う
2. 各日の空き時間（デフォルト 7:00–23:00）を算出
3. 生活習慣を希望時間帯（朝・昼・夜）に優先配置
4. ゴールを分割したサブタスクを、期限までの空き時間に優先度順で配置
5. 配置できなかった項目は「未配置」として表示

## プロジェクト構成

```
src/
  app/api/       # REST API（認証・習慣・ゴール・同期）
  components/    # UI コンポーネント
  lib/
    db/          # Drizzle スキーマ・リポジトリ
    scheduler.ts # スケジュール生成ロジック
    google-*.ts  # Google Calendar / ユーザー連携
```
