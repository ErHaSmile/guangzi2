#!/usr/bin/env bash
# Shared path / naming for multi-app servers (项目 2 · guanzi_2 / 8788).
# Layout:
#   ${SITE_ROOT}/
#     guanzi/          ← 项目 1 品牌官网 (8787)
#     guanzi_2/        ← 本项目 MCN 站 (8788)
#     APPS.txt

# shellcheck disable=SC2034
SITE_ROOT="${SITE_ROOT:-/opt/sites}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
LOG_DIR="${LOG_DIR:-$APP_DIR/logs}"

# 项目 2 默认值（勿与项目 1 的 guanzi / 8787 混淆）
APP_NAME="${APP_NAME:-guanzi_2}"
PM2_NAME="${PM2_NAME:-$APP_NAME}"
PID_FILE="${PID_FILE:-$APP_DIR/logs/${APP_NAME}.pid}"
LOG_FILE="${LOG_FILE:-$APP_DIR/logs/${APP_NAME}.log}"

# 私有仓推荐 SSH Deploy Key（Host: github.com-guanzi2）。可用 REPO_URL 覆盖。
GITHUB_SSH="${GITHUB_SSH:-git@github.com-guanzi2:ErHaSmile/guangzi2.git}"
GITHUB_REPO="${GITHUB_REPO:-https://github.com/ErHaSmile/guangzi2.git}"
GIT_MIRROR="${GIT_MIRROR:-}"

resolve_repo_url() {
  if [ -n "${REPO_URL:-}" ]; then
    echo "$REPO_URL"
    return
  fi
  if [ -n "${GIT_MIRROR:-}" ]; then
    echo "${GIT_MIRROR}${GITHUB_REPO}"
    return
  fi
  echo "$GITHUB_SSH"
}

# 从 .env 读取 APP_NAME / API_PORT（覆盖脚本默认值）
load_dotenv() {
  if [ ! -f "$APP_DIR/.env" ]; then
    API_PORT="${API_PORT:-8788}"
    return
  fi
  local line key val
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%%#*}"
    line="${line%$'\r'}"
    [[ "$line" =~ ^(APP_NAME|API_PORT|PM2_NAME)= ]] || continue
    key="${line%%=*}"
    val="${line#*=}"
    val="${val%\"}"
    val="${val#\"}"
    val="${val%\'}"
    val="${val#\'}"
    case "$key" in
      APP_NAME) APP_NAME="$val" ;;
      API_PORT) API_PORT="$val" ;;
      PM2_NAME) PM2_NAME="$val" ;;
    esac
  done <"$APP_DIR/.env"
  APP_NAME="${APP_NAME:-guanzi_2}"
  PM2_NAME="${PM2_NAME:-$APP_NAME}"
  API_PORT="${API_PORT:-8788}"
  PID_FILE="$APP_DIR/logs/${APP_NAME}.pid"
  LOG_FILE="$APP_DIR/logs/${APP_NAME}.log"
}

# 兼容旧调用名
load_dotenv_port() {
  load_dotenv
}

ensure_scripts_executable() {
  chmod +x "$APP_DIR/update.sh" "$APP_DIR/start.sh" "$APP_DIR"/scripts/*.sh 2>/dev/null || true
}

ensure_log_dir() {
  mkdir -p "$LOG_DIR"
}

print_paths() {
  echo "  SITE_ROOT = $SITE_ROOT"
  echo "  APP_NAME  = $APP_NAME"
  echo "  APP_DIR   = $APP_DIR"
  echo "  PM2_NAME  = $PM2_NAME"
  echo "  API_PORT  = ${API_PORT:-8788}"
  echo "  LOG_DIR   = $LOG_DIR"
  echo "  BRANCH    = $DEPLOY_BRANCH"
  echo "  REPO_URL  = $(resolve_repo_url)"
}

# 校验 / 设置 origin。默认不覆盖已有 remote（避免把 guangzi2 改成 guanzi）。
# 强制纠正：FIX_REMOTE=1 ./update.sh
ensure_git_remote() {
  local expected current
  expected="$(resolve_repo_url)"
  if [ ! -d "$APP_DIR/.git" ]; then
    return 0
  fi
  cd "$APP_DIR"
  if git remote get-url origin >/dev/null 2>&1; then
    current="$(git remote get-url origin)"
    echo "[git] origin = $current"
    if [[ "$current" != *guangzi2* ]]; then
      echo "[git] WARNING: origin 不是项目2仓库 ErHaSmile/guangzi2"
      echo "[git] 期望类似: $expected"
      if [ "${FIX_REMOTE:-}" = "1" ] || [ -n "${REPO_URL:-}" ] || [ -n "${GIT_MIRROR:-}" ]; then
        git remote set-url origin "$expected"
        echo "[git] origin 已改为 $expected"
      else
        echo "[git] 若确认要纠正，执行: FIX_REMOTE=1 ./update.sh"
      fi
    elif [ -n "${REPO_URL:-}" ] || [ -n "${GIT_MIRROR:-}" ]; then
      git remote set-url origin "$expected"
      echo "[git] origin = $expected"
    fi
  else
    git remote add origin "$expected"
    echo "[git] origin = $expected"
  fi
}

restart_app() {
  if command -v pm2 >/dev/null 2>&1; then
    if [ -f "$APP_DIR/ecosystem.config.cjs" ]; then
      # 避免同机误用项目1进程名
      if [ "$PM2_NAME" = "guanzi" ]; then
        echo "[pm2] ERROR: PM2_NAME=guanzi 属于项目1。本项目应为 guanzi_2（检查 .env 的 APP_NAME）"
        exit 1
      fi
      export APP_NAME
      if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
        echo "[pm2] restart $PM2_NAME ..."
        pm2 restart "$PM2_NAME"
      else
        echo "[pm2] start ecosystem.config.cjs (name=$PM2_NAME) ..."
        APP_NAME="$PM2_NAME" pm2 start "$APP_DIR/ecosystem.config.cjs"
        pm2 save || true
      fi
      return
    fi
    if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
      pm2 restart "$PM2_NAME"
    else
      pm2 start "$APP_DIR/server/index.js" --name "$PM2_NAME" --cwd "$APP_DIR"
      pm2 save || true
    fi
    return
  fi

  if [ -f "$PID_FILE" ]; then
    old="$(cat "$PID_FILE" || true)"
    if [ -n "${old:-}" ] && kill -0 "$old" 2>/dev/null; then
      echo "[start] stop pid $old ..."
      kill "$old" || true
      sleep 1
    fi
  fi
  echo "[start] nohup node ..."
  nohup node "$APP_DIR/server/index.js" >>"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  echo "[start] pid $(cat "$PID_FILE"), log $LOG_FILE"
}
