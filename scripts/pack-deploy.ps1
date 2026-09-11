# Pack deploy folder + zip for server upload
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$outName = 'guanzi-deploy'
$outDir = Join-Path $root $outName
$zipPath = Join-Path $root ($outName + '.zip')

Write-Host '[1/4] npm run build ...'
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '[2/4] prepare output dir ...'
if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
New-Item -ItemType Directory -Path $outDir | Out-Null

Write-Host '[3/4] copy files ...'
$deployScripts = Join-Path $root 'scripts\deploy'
Copy-Item (Join-Path $root 'dist') (Join-Path $outDir 'dist') -Recurse
Copy-Item (Join-Path $root 'server') (Join-Path $outDir 'server') -Recurse
Copy-Item (Join-Path $root 'package.json') $outDir
if (Test-Path (Join-Path $root 'package-lock.json')) {
  Copy-Item (Join-Path $root 'package-lock.json') $outDir
}
Copy-Item (Join-Path $root '.env.example') $outDir

$publicOut = Join-Path $outDir 'public'
@(
  'images\uploads',
  'images\brands',
  'videos\uploads',
  'videos'
) | ForEach-Object {
  New-Item -ItemType Directory -Path (Join-Path $publicOut $_) -Force | Out-Null
}

$srcPublic = Join-Path $root 'public'
if (Test-Path $srcPublic) {
  $cfg = Join-Path $srcPublic 'site-config.json'
  if (Test-Path $cfg) { Copy-Item $cfg $publicOut }
  foreach ($sub in @('images', 'videos')) {
    $from = Join-Path $srcPublic $sub
    $to = Join-Path $publicOut $sub
    if (Test-Path $from) {
      Copy-Item $from $to -Recurse -Force
    }
  }
  Get-ChildItem $publicOut -Recurse -Filter '_source*' -ErrorAction SilentlyContinue | Remove-Item -Force
}

$startSh = Get-Content (Join-Path $deployScripts 'start.sh') -Raw
$startSh = $startSh -replace "`r`n", "`n"
[IO.File]::WriteAllText((Join-Path $outDir 'start.sh'), $startSh, (New-Object System.Text.UTF8Encoding $false))
Copy-Item (Join-Path $deployScripts 'start.ps1') (Join-Path $outDir 'start.ps1')
Copy-Item (Join-Path $deployScripts 'start.bat') (Join-Path $outDir 'start.bat')
Copy-Item (Join-Path $deployScripts 'README-DEPLOY.txt') (Join-Path $outDir 'README-DEPLOY.txt')
Copy-Item (Join-Path $deployScripts 'README-DEPLOY.zh.txt') (Join-Path $outDir 'README-DEPLOY.zh.txt')

$envSrc = Join-Path $root '.env'
if (Test-Path $envSrc) {
  Copy-Item $envSrc (Join-Path $outDir '.env.local-reference')
}

Write-Host '[4/4] zip ...'
Compress-Archive -Path $outDir -DestinationPath $zipPath -CompressionLevel Optimal

$size = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host ''
Write-Host 'DONE'
Write-Host ('  dir:  ' + $outDir)
Write-Host ('  zip:  ' + $zipPath + ' (' + $size + ' MB)')
Write-Host 'Upload to server, edit .env, then run start.bat or ./start.sh'
