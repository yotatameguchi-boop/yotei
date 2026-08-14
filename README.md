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
4. 承認済みリダイレクト URI に `http://localhost:3000/api/auth/callback` を追加
5. `.env.local` に以下を設定

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
AUTH_SECRET=長いランダム文字列
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

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
```

## 技術スタック

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS 4
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
  app/           # Next.js App Router（ページ・API）
  components/    # UI コンポーネント
  lib/           # スケジューラ、Google連携、型定義
```
