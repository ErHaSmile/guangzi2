#!/usr/bin/env bash
# Shared path / naming for multi-app servers.
# Layout:
#   ${SITE_ROOT}/
#     guanzi/          ← this project (APP_NAME)
#     other-app/
#     APPS.txt         ← inventory (optional)

# shellcheck disable=SC2034
SITE_ROOT="${SITE_ROOT:-/opt/sites}"
APP_NAME="${APP_NAME:-guanzi}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
PM2_NAME="${PM2_NAME:-$APP_NAME}"
LOG_DIR="${LOG_DIR:-$APP_DIR/logs}"
PID_FILE="${PID_FILE:-$APP_DIR/logs/${APP_NAME}.pid}"
LOG_FILE="${LOG_FILE:-$APP_DIR/logs/${APP_NAME}.log}"

# 私有仓推荐 SSH（Deploy Key）。也可用 REPO_URL 覆盖。
# HTTPS 镜像对 Private 基本不可用。
GITHUB_SSH="${GITHUB_SSH:-git@github.com-guanzi:ErHaSmile/guanzi.git}"
GITHUB_REPO="${GITHUB_REPO:-https://github.com/ErHaSmile/guanzi.git}"
GIT_MIRROR="${GIT_MIRROR:-}"

resolve_repo_url() {
  if [ -n "${REPO_URL:-}" ]; then
    echo "$REPO_URL"
    return
  fi
  # 显式指定镜像时才走 HTTPS 镜像（公开仓）
  if [ -n "${GIT_MIRROR:-}" ]; then
    echo "${GIT_MIRROR}${GITHUB_REPO}"
    return
  fi
  # 默认 SSH（私有仓）
  echo "$GITHUB_SSH"
}

ensure_log_dir() {
  mkdir -p "$LOG_DIR"
}

load_dotenv_port() {
  if [ -f "$APP_DIR/.env" ]; then
    local line
    line="$(grep -E '^API_PORT=' "$APP_DIR/.env" | tail -n 1 || true)"
    if [ -n "$line" ]; then
      API_PORT="${line#API_PORT=}"
      API_PORT="${API_PORT%$'\r'}"
    fi
  fi
  API_PORT="${API_PORT:-8787}"
}

print_paths() {
  echo "  SITE_ROOT = $SITE_ROOT"
  echo "  APP_NAME  = $APP_NAME"
  echo "  APP_DIR   = $APP_DIR"
  echo "  PM2_NAME  = $PM2_NAME"
  echo "  LOG_DIR   = $LOG_DIR"
  echo "  BRANCH    = $DEPLOY_BRANCH"
  echo "  REPO_URL  = $(resolve_repo_url)"
}

# 确保 origin 指向可用地址
ensure_git_remote() {
  local url
  url="$(resolve_repo_url)"
  if [ ! -d "$APP_DIR/.git" ]; then
    return 0
  fi
  cd "$APP_DIR"
  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "$url"
  else
    git remote add origin "$url"
  fi
  echo "[git] origin = $url"
}
