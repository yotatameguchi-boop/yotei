#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TURSO="${ROOT}/.tools/turso"
DB_NAME="${TURSO_DB_NAME:-yotei-prod}"

if [[ ! -x "$TURSO" ]]; then
  echo "Turso CLI not found. Downloading..."
  mkdir -p "${ROOT}/.tools"
  curl -sL -o "${ROOT}/.tools/turso.tar.gz" \
    https://github.com/tursodatabase/turso-cli/releases/download/v1.0.32/turso-cli_Darwin_arm64.tar.gz
  tar -xzf "${ROOT}/.tools/turso.tar.gz" -C "${ROOT}/.tools"
  chmod +x "${ROOT}/.tools/turso"
fi

if ! "$TURSO" auth whoami >/dev/null 2>&1; then
  echo "Turso にログインしてください:"
  "$TURSO" auth login
fi

if ! "$TURSO" db show "$DB_NAME" >/dev/null 2>&1; then
  echo "Creating Turso database: $DB_NAME"
  "$TURSO" db create "$DB_NAME" --wait
fi

DB_URL="$("$TURSO" db show "$DB_NAME" --url)"
DB_TOKEN="$("$TURSO" db tokens create "$DB_NAME")"

echo ""
echo "Turso database ready: $DB_NAME"
echo ""
echo "Add these to Vercel (production):"
echo "  TURSO_DATABASE_URL=$DB_URL"
echo "  TURSO_AUTH_TOKEN=$DB_TOKEN"
echo ""

if command -v npx >/dev/null 2>&1; then
  read -r -p "Vercel production に環境変数を設定しますか? [y/N] " CONFIRM
  if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
    cd "$ROOT"
    printf '%s' "$DB_URL" | npx vercel env add TURSO_DATABASE_URL production
    printf '%s' "$DB_TOKEN" | npx vercel env add TURSO_AUTH_TOKEN production
    echo "Vercel env vars added. Redeploying..."
    npx vercel --prod
  fi
fi
