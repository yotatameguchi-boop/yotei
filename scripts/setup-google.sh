#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"

echo "=== 予定 (yotei) Google Calendar セットアップ ==="
echo ""

if [[ -f "$ENV_FILE" ]]; then
  echo "既存の .env.local を読み込みます"
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  cp "$ROOT/.env.example" "$ENV_FILE"
fi

if [[ -z "${AUTH_SECRET:-}" || "${AUTH_SECRET}" == "change-me-to-a-long-random-string" ]]; then
  AUTH_SECRET="$(openssl rand -base64 32)"
  if grep -q '^AUTH_SECRET=' "$ENV_FILE"; then
    sed -i '' "s|^AUTH_SECRET=.*|AUTH_SECRET=$AUTH_SECRET|" "$ENV_FILE"
  else
    echo "AUTH_SECRET=$AUTH_SECRET" >> "$ENV_FILE"
  fi
  echo "✓ AUTH_SECRET を生成しました"
fi

echo ""
echo "Google Cloud Console で以下を設定してください:"
echo "  1. https://console.cloud.google.com/ でプロジェクト作成"
echo "  2. 「APIとサービス」→「ライブラリ」→ Google Calendar API を有効化"
echo "  3. 「OAuth同意画面」を設定（テストユーザーに自分の Gmail を追加）"
echo "  4. 「認証情報」→「OAuth 2.0 クライアント ID」→ Web アプリケーション"
echo "     承認済みリダイレクト URI: http://localhost:3000/api/auth/callback"
echo ""

read -r -p "GOOGLE_CLIENT_ID: " CLIENT_ID
read -r -p "GOOGLE_CLIENT_SECRET: " CLIENT_SECRET

if [[ -n "$CLIENT_ID" ]]; then
  if grep -q '^GOOGLE_CLIENT_ID=' "$ENV_FILE"; then
    sed -i '' "s|^GOOGLE_CLIENT_ID=.*|GOOGLE_CLIENT_ID=$CLIENT_ID|" "$ENV_FILE"
  else
    echo "GOOGLE_CLIENT_ID=$CLIENT_ID" >> "$ENV_FILE"
  fi
fi

if [[ -n "$CLIENT_SECRET" ]]; then
  if grep -q '^GOOGLE_CLIENT_SECRET=' "$ENV_FILE"; then
    sed -i '' "s|^GOOGLE_CLIENT_SECRET=.*|GOOGLE_CLIENT_SECRET=$CLIENT_SECRET|" "$ENV_FILE"
  else
    echo "GOOGLE_CLIENT_SECRET=$CLIENT_SECRET" >> "$ENV_FILE"
  fi
fi

echo ""
echo "✓ .env.local を更新しました: $ENV_FILE"
echo ""
echo "次のステップ:"
echo "  npm run dev"
echo "  → http://localhost:3000 を開き「接続する」をクリック"
