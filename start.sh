#!/usr/bin/env bash
# 一键启动 / 重启（不拉代码）。更新请用 ./update.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/server-common.sh"
cd "$APP_DIR"

ensure_scripts_executable
load_dotenv
ensure_log_dir

echo "[start] paths"
print_paths

if [ ! -f .env ]; then
  echo "[start] missing .env — cp .env.example .env 后编辑"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[start] 无 node_modules，先执行 ./scripts/server-setup.sh 或 ./update.sh"
  exit 1
fi

restart_app
echo "[start] OK → http://127.0.0.1:${API_PORT}/  (app=$APP_NAME)"
echo "[start] health: curl -s http://127.0.0.1:${API_PORT}/health"
