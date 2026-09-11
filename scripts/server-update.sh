#!/usr/bin/env bash
# One-click update: pull → install → migrate → build → restart
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/server-common.sh"
cd "$APP_DIR"

echo "[update] paths"
print_paths
ensure_log_dir
load_dotenv_port
ensure_git_remote

if [ ! -f .env ]; then
  echo "[update] missing .env in $APP_DIR"
  exit 1
fi

echo "[update] git pull ($DEPLOY_BRANCH) ..."
if ! git fetch --all --prune; then
  echo "[update] fetch failed. Try another mirror, e.g.:"
  echo "  GIT_MIRROR=https://mirror.ghproxy.com/ ./update.sh"
  echo "  REPO_URL=https://gitclone.com/github.com/ErHaSmile/guanzi.git ./update.sh"
  exit 1
fi
git pull --ff-only origin "$DEPLOY_BRANCH"

echo "[update] npm install ..."
npm install

echo "[update] db migrate ..."
npm run db:migrate || true

echo "[update] build ..."
npm run build

restart_app() {
  if command -v pm2 >/dev/null 2>&1; then
    if [ -f "$APP_DIR/ecosystem.config.cjs" ]; then
      if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
        echo "[update] pm2 restart $PM2_NAME ..."
        pm2 restart "$PM2_NAME"
      else
        echo "[update] pm2 start ecosystem.config.cjs ..."
        pm2 start "$APP_DIR/ecosystem.config.cjs"
        pm2 save || true
      fi
    else
      if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
        pm2 restart "$PM2_NAME"
      else
        pm2 start server/index.js --name "$PM2_NAME" --cwd "$APP_DIR"
        pm2 save || true
      fi
    fi
    return
  fi

  if [ -f "$PID_FILE" ]; then
    old="$(cat "$PID_FILE" || true)"
    if [ -n "${old:-}" ] && kill -0 "$old" 2>/dev/null; then
      echo "[update] stop pid $old ..."
      kill "$old" || true
      sleep 1
    fi
  fi
  echo "[update] start node (nohup) ..."
  nohup node server/index.js >>"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  echo "[update] pid $(cat "$PID_FILE"), log $LOG_FILE"
}

restart_app
echo "[update] OK → http://127.0.0.1:${API_PORT}/  (app=$APP_NAME)"
