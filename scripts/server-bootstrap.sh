#!/usr/bin/env bash
# Bootstrap: create /opt/sites layout and clone via SSH (private repo).
# Prerequisite: Deploy Key configured — see scripts/server-ssh-setup.sh
set -euo pipefail

ROOT_HINT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
if [ -f "$ROOT_HINT/scripts/server-common.sh" ]; then
  # shellcheck source=server-common.sh
  source "$ROOT_HINT/scripts/server-common.sh"
fi

SITE_ROOT="${SITE_ROOT:-/opt/sites}"
APP_NAME="${APP_NAME:-guanzi}"
BRANCH="${DEPLOY_BRANCH:-main}"
APP_DIR="${SITE_ROOT}/${APP_NAME}"
# 默认用 SSH 别名（Deploy Key）；可用 REPO_URL 覆盖
REPO_URL="${REPO_URL:-git@github.com-guanzi:ErHaSmile/guanzi.git}"

echo "[bootstrap] multi-app layout"
echo "  SITE_ROOT = $SITE_ROOT"
echo "  APP_NAME  = $APP_NAME"
echo "  APP_DIR   = $APP_DIR"
echo "  REPO      = $REPO_URL"

if [ "$(id -u)" -eq 0 ]; then
  mkdir -p "$SITE_ROOT"
else
  if [ ! -d "$SITE_ROOT" ]; then
    echo "[bootstrap] need sudo to create $SITE_ROOT"
    sudo mkdir -p "$SITE_ROOT"
    sudo chown -R "$(whoami):$(whoami)" "$SITE_ROOT"
  fi
fi

mkdir -p "$SITE_ROOT"
INVENTORY="$SITE_ROOT/APPS.txt"
if [ ! -f "$INVENTORY" ]; then
  cat > "$INVENTORY" <<EOF
# Server app inventory
# path | repo | port | notes
EOF
fi

if [ -d "$APP_DIR/.git" ]; then
  echo "[bootstrap] already cloned: $APP_DIR"
  cd "$APP_DIR"
  git remote set-url origin "$REPO_URL"
  git fetch --all --prune
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
else
  if [ -e "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null || true)" ]; then
    echo "[bootstrap] $APP_DIR exists and is not empty — abort"
    exit 1
  fi
  echo "[bootstrap] cloning (SSH) ..."
  if ! git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"; then
    echo "[bootstrap] clone failed. Run first:"
    echo "  bash scripts/server-ssh-setup.sh"
    echo "  # add the printed pubkey to GitHub Deploy keys"
    echo "  ssh -T git@github.com-guanzi"
    exit 1
  fi
  cd "$APP_DIR"
fi

mkdir -p "$APP_DIR/logs"
chmod +x "$APP_DIR"/scripts/*.sh "$APP_DIR"/update.sh 2>/dev/null || true

if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  echo "[bootstrap] wrote $APP_DIR/.env — edit MySQL / tokens, then:"
  echo "  cd $APP_DIR && ./scripts/server-setup.sh"
  echo "  pm2 start ecosystem.config.cjs"
else
  echo "[bootstrap] .env exists — run setup if needed:"
  echo "  cd $APP_DIR && ./scripts/server-setup.sh"
fi

if ! grep -q "$APP_DIR" "$INVENTORY" 2>/dev/null; then
  echo "${APP_DIR} | ${REPO_URL} | 8787 | ${APP_NAME}" >> "$INVENTORY"
fi

echo "[bootstrap] done → cd $APP_DIR"
