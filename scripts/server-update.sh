#!/usr/bin/env bash
# 一键更新并启动：pull → install → migrate → build → pm2 restart
# 用法（在项目根目录）:
#   ./update.sh
#   bash update.sh                    # 无执行权限时
#   FORCE_RESET=1 ./update.sh         # 本地与远程分叉、部署机可丢弃本地提交时
#   FIX_REMOTE=1 ./update.sh          # origin 指错仓库时纠正为 guangzi2
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/server-common.sh"
cd "$APP_DIR"

ensure_scripts_executable
load_dotenv
ensure_log_dir

echo "[update] paths"
print_paths
ensure_git_remote

if [ ! -f .env ]; then
  echo "[update] missing .env in $APP_DIR — cp .env.example .env 后编辑再跑"
  exit 1
fi

if [[ "$(git remote get-url origin 2>/dev/null || true)" != *guangzi2* ]]; then
  echo "[update] ERROR: 当前目录不是项目2仓库（origin 应含 guangzi2）"
  echo "  正确: git@github.com-guanzi2:ErHaSmile/guangzi2.git"
  echo "  纠正: FIX_REMOTE=1 ./update.sh   或重新 clone 到 /opt/sites/guanzi_2"
  exit 1
fi

echo "[update] git fetch ($DEPLOY_BRANCH) ..."
if ! git fetch --all --prune; then
  echo "[update] fetch failed. 可试镜像，例如:"
  echo "  GIT_MIRROR=https://mirror.ghproxy.com/ ./update.sh"
  exit 1
fi

echo "[update] git pull --ff-only ..."
if ! git pull --ff-only origin "$DEPLOY_BRANCH"; then
  if [ "${FORCE_RESET:-}" = "1" ]; then
    echo "[update] FORCE_RESET=1 → reset --hard origin/$DEPLOY_BRANCH"
    git reset --hard "origin/$DEPLOY_BRANCH"
  else
    echo "[update] 分支已分叉，无法快进。"
    echo "  部署机若无需保留本地提交: FORCE_RESET=1 ./update.sh"
    echo "  或手动: git merge origin/$DEPLOY_BRANCH"
    exit 1
  fi
fi

echo "[update] npm install ..."
npm install

echo "[update] db migrate ..."
npm run db:migrate || true

echo "[update] build ..."
npm run build

restart_app
echo "[update] OK → http://127.0.0.1:${API_PORT}/  (app=$APP_NAME)"
echo "[update] health: curl -s http://127.0.0.1:${API_PORT}/health"
