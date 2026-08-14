#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"

echo "=== 予定 (yotei) Google Calendar セットアップ ==="
echo ""
echo "Client Secret は不要です。Client ID だけ設定すれば、"
echo "ユーザーはボタン1つでカレンダー連携できます。"
echo ""

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT/.env.example" "$ENV_FILE"
fi

echo "Google Cloud Console で以下を設定:"
echo "  1. https://console.cloud.google.com/apis/library/calendar-json.googleapis.com を有効化"
echo "  2. OAuth 2.0 クライアント ID（Web）を作成"
echo "  3. 承認済み JavaScript 生成元:"
echo "     - http://localhost:3000"
echo "     - https://yotei-sigma.vercel.app"
echo ""

read -r -p "NEXT_PUBLIC_GOOGLE_CLIENT_ID: " CLIENT_ID

if [[ -n "$CLIENT_ID" ]]; then
  if grep -q '^NEXT_PUBLIC_GOOGLE_CLIENT_ID=' "$ENV_FILE"; then
    sed -i '' "s|^NEXT_PUBLIC_GOOGLE_CLIENT_ID=.*|NEXT_PUBLIC_GOOGLE_CLIENT_ID=$CLIENT_ID|" "$ENV_FILE"
  else
    echo "NEXT_PUBLIC_GOOGLE_CLIENT_ID=$CLIENT_ID" >> "$ENV_FILE"
  fi
fi

echo ""
echo "✓ .env.local を更新しました"
echo "  npm run dev → 「Googleカレンダーと連携」ボタンを押すだけ"
