# 光子文化官网 - 服务器一键启动（Linux / macOS）
set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "[错误] 缺少 .env，请复制 .env.example 为 .env 并填写 MySQL 等信息"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未找到 node，请先安装 Node.js 18+"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[安装] npm install --omit=dev ..."
  npm install --omit=dev
fi

if [ ! -d dist ]; then
  echo "[错误] 缺少 dist/，请使用本地打包脚本生成的部署包"
  exit 1
fi

echo "[数据库] 执行迁移（已有表会跳过种子）..."
node server/migrate.js || true

echo "[启动] 站点 + API ..."
exec node server/index.js
