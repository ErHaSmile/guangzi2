#!/usr/bin/env bash
# First-time setup inside the app directory
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/server-common.sh"
cd "$APP_DIR"

echo "[setup] paths"
print_paths
ensure_log_dir

if [ ! -f .env ]; then
  cp .env.example .env
  echo "[setup] created .env — edit MySQL / ADMIN_TOKEN / VITE_ADMIN_TOKEN then re-run"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[setup] Node.js 18+ required"
  exit 1
fi

echo "[setup] npm install ..."
npm install

echo "[setup] db migrate ..."
npm run db:migrate

echo "[setup] build ..."
npm run build

echo "[setup] done"
echo "  Start:  pm2 start ecosystem.config.cjs"
echo "  Update: ./update.sh"
echo "  Logs:   $LOG_DIR"
