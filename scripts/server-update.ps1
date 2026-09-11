# Windows server update (optional)
$ErrorActionPreference = 'Stop'
$AppDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $AppDir

$AppName = if ($env:APP_NAME) { $env:APP_NAME } else { 'guanzi' }
$Branch = if ($env:DEPLOY_BRANCH) { $env:DEPLOY_BRANCH } else { 'main' }
$LogDir = Join-Path $AppDir 'logs'
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

if (-not (Test-Path '.env')) {
  Write-Host "[update] missing .env in $AppDir" -ForegroundColor Red
  exit 1
}

Write-Host "[update] app=$AppName dir=$AppDir branch=$Branch"
git fetch --all --prune
git pull --ff-only origin $Branch

npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run db:migrate
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
if ($pm2) {
  $eco = Join-Path $AppDir 'ecosystem.config.cjs'
  $listed = & pm2 jlist 2>$null
  if ($listed -match ('"name":"' + $AppName + '"')) {
    pm2 restart $AppName
  } elseif (Test-Path $eco) {
    pm2 start $eco
    pm2 save
  } else {
    pm2 start server/index.js --name $AppName
    pm2 save
  }
} else {
  Write-Host '[update] start node (foreground). Install pm2 for background.'
  node server/index.js
}

Write-Host '[update] OK'
