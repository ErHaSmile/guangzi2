# 光子文化官网 - 服务器一键启动（Windows PowerShell）
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

if (-not (Test-Path '.env')) {
  Write-Host '[错误] 缺少 .env，请复制 .env.example 为 .env 并填写 MySQL 等信息' -ForegroundColor Red
  exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host '[错误] 未找到 node，请先安装 Node.js 18+' -ForegroundColor Red
  exit 1
}

if (-not (Test-Path 'node_modules')) {
  Write-Host '[安装] npm install --omit=dev ...'
  npm install --omit=dev
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not (Test-Path 'dist')) {
  Write-Host '[错误] 缺少 dist/，请使用本地打包脚本生成的部署包' -ForegroundColor Red
  exit 1
}

Write-Host '[数据库] 执行迁移（已有表会跳过种子）...'
node server/migrate.js
Write-Host '[启动] 站点 + API ...'
node server/index.js
