# Guanzi static preview server (site + admin + media API)
# Requires: Windows PowerShell 5+ / PowerShell 7+
$ErrorActionPreference = 'Stop'
$port = 8765
$root = $PSScriptRoot
$prefix = "http://127.0.0.1:$port/"

$mimeMap = @{
  '.html' = 'text/html; charset=utf-8'
  '.htm'  = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.gif'  = 'image/gif'
  '.webp' = 'image/webp'
  '.ico'  = 'image/x-icon'
  '.mp4'  = 'video/mp4'
  '.webm' = 'video/webm'
  '.ogg'  = 'video/ogg'
  '.mov'  = 'video/quicktime'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
  '.ttf'  = 'font/ttf'
  '.map'  = 'application/json'
}

$imageExt = @('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico')
$videoExt = @('.mp4', '.webm', '.ogg', '.mov', '.m4v')

function Ensure-UploadDirs {
  foreach ($rel in @('images\brands', 'images\uploads', 'videos', 'videos\uploads')) {
    $p = Join-Path $root $rel
    if (-not (Test-Path -LiteralPath $p)) {
      New-Item -ItemType Directory -Path $p | Out-Null
    }
  }
}

function Write-JsonResponse {
  param($Response, [int]$StatusCode, $Object)
  $json = $Object | ConvertTo-Json -Depth 10 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $Response.StatusCode = $StatusCode
  $Response.ContentType = 'application/json; charset=utf-8'
  $Response.ContentLength64 = $bytes.LongLength
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Write-TextResponse {
  param($Response, [int]$StatusCode, [string]$Text, [string]$ContentType = 'text/plain; charset=utf-8')
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  $Response.StatusCode = $StatusCode
  $Response.ContentType = $ContentType
  $Response.ContentLength64 = $bytes.LongLength
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Get-MediaList {
  param([string]$Dir, [string]$UrlPrefix, [string[]]$Exts, [string]$Kind)
  if (-not (Test-Path -LiteralPath $Dir)) { return @() }
  $items = @()
  Get-ChildItem -LiteralPath $Dir -File | ForEach-Object {
    $name = $_.Name
    if ($name.StartsWith('_') -or $name.StartsWith('.')) { return }
    $ext = $_.Extension.ToLowerInvariant()
    if ($Exts -notcontains $ext) { return }
    $items += [pscustomobject]@{
      name  = $name
      path  = ($UrlPrefix + '/' + $name)
      size  = $_.Length
      mtime = ([DateTimeOffset]$_.LastWriteTimeUtc).ToUnixTimeMilliseconds()
      kind  = $Kind
    }
  }
  return @($items | Sort-Object mtime -Descending)
}

function Get-VideoListRecursive {
  $videosRoot = Join-Path $root 'videos'
  if (-not (Test-Path -LiteralPath $videosRoot)) { return @() }
  $items = @()
  Get-ChildItem -LiteralPath $videosRoot -File -Recurse | ForEach-Object {
    if ($_.DirectoryName -match '[\\/]uploads$') { return }
    if ($_.Name.StartsWith('_') -or $_.Name.StartsWith('.')) { return }
    $ext = $_.Extension.ToLowerInvariant()
    if ($videoExt -notcontains $ext) { return }
    $rel = $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
    $items += [pscustomobject]@{
      name  = $_.Name
      path  = '/' + $rel
      size  = $_.Length
      mtime = ([DateTimeOffset]$_.LastWriteTimeUtc).ToUnixTimeMilliseconds()
      kind  = 'video'
    }
  }
  return @($items | Sort-Object mtime -Descending)
}

function Get-SafeFileName {
  param([string]$Name, [string]$FallbackExt)
  $base = [System.IO.Path]::GetFileName($(if ($Name) { $Name } else { 'file' + $FallbackExt }))
  $base = [regex]::Replace($base, '[^\w.\-]+', '_')
  $ext = [System.IO.Path]::GetExtension($base)
  if (-not $ext) { $ext = $FallbackExt }
  $stem = [System.IO.Path]::GetFileNameWithoutExtension($base)
  if ([string]::IsNullOrWhiteSpace($stem)) { $stem = 'file' }
  if ($stem.Length -gt 40) { $stem = $stem.Substring(0, 40) }
  $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  return ($stamp.ToString() + '-' + $stem + $ext.ToLowerInvariant())
}

function Read-RequestBody {
  param($Request)
  $ms = New-Object System.IO.MemoryStream
  $Request.InputStream.CopyTo($ms)
  return $ms.ToArray()
}

function Find-Bytes {
  param([byte[]]$Haystack, [byte[]]$Needle, [int]$Start)
  if ($null -eq $Haystack -or $null -eq $Needle -or $Needle.Length -eq 0) { return -1 }
  $limit = $Haystack.Length - $Needle.Length
  for ($i = $Start; $i -le $limit; $i++) {
    $ok = $true
    for ($j = 0; $j -lt $Needle.Length; $j++) {
      if ($Haystack[$i + $j] -ne $Needle[$j]) { $ok = $false; break }
    }
    if ($ok) { return $i }
  }
  return -1
}

function Get-MultipartParts {
  param([byte[]]$Buffer, [string]$Boundary)
  $parts = @()
  $sep = [System.Text.Encoding]::UTF8.GetBytes('--' + $Boundary)
  $headerSep = [System.Text.Encoding]::UTF8.GetBytes("`r`n`r`n")
  $idx = Find-Bytes -Haystack $Buffer -Needle $sep -Start 0
  if ($idx -lt 0) { return $parts }
  $start = $idx + $sep.Length
  while ($start -lt $Buffer.Length) {
    if (($start + 1) -lt $Buffer.Length -and $Buffer[$start] -eq 45 -and $Buffer[$start + 1] -eq 45) { break }
    if (($start + 1) -lt $Buffer.Length -and $Buffer[$start] -eq 13 -and $Buffer[$start + 1] -eq 10) { $start += 2 }
    $headerEnd = Find-Bytes -Haystack $Buffer -Needle $headerSep -Start $start
    if ($headerEnd -lt 0) { break }
    $headerLen = $headerEnd - $start
    $headerText = ''
    if ($headerLen -gt 0) {
      $headerText = [System.Text.Encoding]::UTF8.GetString($Buffer, $start, $headerLen)
    }
    $next = Find-Bytes -Haystack $Buffer -Needle $sep -Start ($headerEnd + 4)
    $contentStart = $headerEnd + 4
    $contentEnd = if ($next -lt 0) { $Buffer.Length } else { $next - 2 }
    if ($contentEnd -lt $contentStart) { $contentEnd = $contentStart }
    $len = $contentEnd - $contentStart
    $content = New-Object byte[] $len
    if ($len -gt 0) {
      [System.Buffer]::BlockCopy($Buffer, $contentStart, $content, 0, $len)
    }
    $name = ''
    $filename = ''
    $partMime = ''
    $m = [regex]::Match($headerText, 'name="([^"]+)"')
    if ($m.Success) { $name = $m.Groups[1].Value }
    $m = [regex]::Match($headerText, 'filename="([^"]*)"')
    if ($m.Success) { $filename = $m.Groups[1].Value }
    $m = [regex]::Match($headerText, 'Content-Type:\s*(.+)', 'IgnoreCase')
    if ($m.Success) { $partMime = $m.Groups[1].Value.Trim() }
    $parts += [pscustomobject]@{
      name = $name
      filename = $filename
      mime = $partMime
      data = $content
    }
    if ($next -lt 0) { break }
    $start = $next + $sep.Length
  }
  return $parts
}

function Handle-MediaApi {
  param($Context)
  $req = $Context.Request
  $res = $Context.Response
  $pathOnly = $req.Url.AbsolutePath
  $method = $req.HttpMethod

  if ($method -eq 'GET' -and $pathOnly -eq '/api/media') {
    $payload = [pscustomobject]@{
      brands  = @(Get-MediaList -Dir (Join-Path $root 'images\brands') -UrlPrefix '/images/brands' -Exts $imageExt -Kind 'image')
      uploads = @(Get-MediaList -Dir (Join-Path $root 'images\uploads') -UrlPrefix '/images/uploads' -Exts $imageExt -Kind 'image')
      videos  = @((Get-VideoListRecursive) + (Get-MediaList -Dir (Join-Path $root 'videos\uploads') -UrlPrefix '/videos/uploads' -Exts $videoExt -Kind 'video'))
    }
    Write-JsonResponse -Response $res -StatusCode 200 -Object $payload
    return
  }

  if ($method -eq 'POST' -and $pathOnly -eq '/api/media/upload') {
    $ctype = [string]$req.ContentType
    if ($ctype.Contains('multipart/form-data')) {
      $boundary = ($ctype -split 'boundary=')[-1].Trim()
      if (-not $boundary) {
        Write-JsonResponse -Response $res -StatusCode 400 -Object @{ error = 'invalid multipart' }
        return
      }
      $raw = Read-RequestBody -Request $req
      $parts = Get-MultipartParts -Buffer $raw -Boundary $boundary
      $filePart = $parts | Where-Object { $_.filename } | Select-Object -First 1
      if (-not $filePart) {
        Write-JsonResponse -Response $res -StatusCode 400 -Object @{ error = 'missing file' }
        return
      }
      $partMime = [string]$filePart.mime
      $fileExt = [System.IO.Path]::GetExtension([string]$filePart.filename).ToLowerInvariant()
      $isVideo = $partMime.StartsWith('video/') -or ($videoExt -contains $fileExt)
      $isImage = $partMime.StartsWith('image/') -or ($imageExt -contains $fileExt)
      if (-not $isVideo -and -not $isImage) {
        Write-JsonResponse -Response $res -StatusCode 400 -Object @{ error = 'only image or video' }
        return
      }
      $maxBytes = if ($isVideo) { 120 * 1024 * 1024 } else { 8 * 1024 * 1024 }
      if ($filePart.data.Length -gt $maxBytes) {
        Write-JsonResponse -Response $res -StatusCode 400 -Object @{ error = 'file too large' }
        return
      }
      $fallback = if ($isVideo) { '.mp4' } else { '.png' }
      $filename = Get-SafeFileName -Name $filePart.filename -FallbackExt $fallback
      if ($isVideo) {
        $dir = Join-Path $root 'videos\uploads'
        $urlPrefix = '/videos/uploads'
        $kind = 'video'
      } else {
        $dir = Join-Path $root 'images\uploads'
        $urlPrefix = '/images/uploads'
        $kind = 'image'
      }
      [System.IO.File]::WriteAllBytes((Join-Path $dir $filename), $filePart.data)
      Write-JsonResponse -Response $res -StatusCode 200 -Object @{
        path = ($urlPrefix + '/' + $filename)
        name = $filename
        size = $filePart.data.Length
        kind = $kind
      }
      return
    }

    $raw = Read-RequestBody -Request $req
    $text = [System.Text.Encoding]::UTF8.GetString($raw)
    $body = $text | ConvertFrom-Json
    $bodyMime = if ($body.mime) { [string]$body.mime } else { 'image/png' }
    if (-not $bodyMime.StartsWith('image/')) {
      Write-JsonResponse -Response $res -StatusCode 400 -Object @{ error = 'json upload supports image only' }
      return
    }
    $dataUrl = [string]$body.data
    $b64 = $null
    $m = [regex]::Match($dataUrl, '^data:image/[^;]+;base64,(.+)')
    if ($m.Success) {
      $b64 = $m.Groups[1].Value
    } elseif ($body.base64) {
      $b64 = [string]$body.base64
    }
    if (-not $b64) {
      Write-JsonResponse -Response $res -StatusCode 400 -Object @{ error = 'missing image data' }
      return
    }
    $buf = [Convert]::FromBase64String($b64)
    if ($buf.Length -gt (8 * 1024 * 1024)) {
      Write-JsonResponse -Response $res -StatusCode 400 -Object @{ error = 'image too large' }
      return
    }
    $filename = Get-SafeFileName -Name ([string]$body.filename) -FallbackExt '.png'
    $dir = Join-Path $root 'images\uploads'
    [System.IO.File]::WriteAllBytes((Join-Path $dir $filename), $buf)
    Write-JsonResponse -Response $res -StatusCode 200 -Object @{
      path = ('/images/uploads/' + $filename)
      name = $filename
      size = $buf.Length
      kind = 'image'
    }
    return
  }

  if ($method -eq 'DELETE' -and $pathOnly -eq '/api/media') {
    $filePath = [string]$req.QueryString['path']
    $okPrefix = $filePath.StartsWith('/images/uploads/') -or $filePath.StartsWith('/videos/uploads/')
    if (-not $filePath -or -not $okPrefix) {
      Write-JsonResponse -Response $res -StatusCode 400 -Object @{ error = 'only uploads can be deleted' }
      return
    }
    $rel = $filePath.TrimStart('/').Replace('/', '\')
    $abs = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
    $uploadsImg = [System.IO.Path]::GetFullPath((Join-Path $root 'images\uploads'))
    $uploadsVid = [System.IO.Path]::GetFullPath((Join-Path $root 'videos\uploads'))
    if (-not ($abs.StartsWith($uploadsImg) -or $abs.StartsWith($uploadsVid))) {
      Write-JsonResponse -Response $res -StatusCode 400 -Object @{ error = 'invalid path' }
      return
    }
    if (Test-Path -LiteralPath $abs -PathType Leaf) {
      Remove-Item -LiteralPath $abs -Force
    }
    Write-JsonResponse -Response $res -StatusCode 200 -Object @{ ok = $true }
    return
  }

  Write-JsonResponse -Response $res -StatusCode 404 -Object @{ error = 'Not found' }
}

function Get-LeadsFile {
  $dir = Join-Path $root 'data'
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  return (Join-Path $dir 'contact-leads.json')
}

function Read-Leads {
  $file = Get-LeadsFile
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    Set-Content -LiteralPath $file -Value '[]' -Encoding UTF8
    return @()
  }
  try {
    $raw = Get-Content -LiteralPath $file -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) { return @() }
    $data = $raw | ConvertFrom-Json
    if ($null -eq $data) { return @() }
    if ($data -is [System.Array]) { return @($data) }
    return @($data)
  } catch {
    return @()
  }
}

function Write-Leads {
  param([object[]]$Items)
  $file = Get-LeadsFile
  $json = ($Items | ConvertTo-Json -Depth 6)
  if ($null -eq $json) { $json = '[]' }
  if ($Items.Count -eq 1) { $json = '[' + $json + ']' }
  Set-Content -LiteralPath $file -Value $json -Encoding UTF8
}

function Handle-LeadsApi {
  param($Context)
  $req = $Context.Request
  $res = $Context.Response
  $pathOnly = $req.Url.AbsolutePath
  $method = $req.HttpMethod

  if ($method -eq 'GET' -and $pathOnly -eq '/api/leads') {
    $items = @(Read-Leads | Sort-Object { $_.createdAt } -Descending)
    Write-JsonResponse -Response $res -StatusCode 200 -Object @{ items = $items; total = $items.Count }
    return
  }

  if ($method -eq 'POST' -and $pathOnly -eq '/api/leads') {
    $raw = Read-RequestBody -Request $req
    $text = [System.Text.Encoding]::UTF8.GetString($raw)
    try {
      $body = $text | ConvertFrom-Json
    } catch {
      Write-JsonResponse -Response $res -StatusCode 400 -Object @{ error = 'invalid json' }
      return
    }
    $name = ([string]$body.name).Trim()
    $tel = ([string]$body.tel).Trim()
    $company = ([string]$body.company).Trim()
    $content = ([string]$body.content).Trim()
    if (-not $name -or -not $tel -or -not $content) {
      Write-JsonResponse -Response $res -StatusCode 400 -Object @{ error = 'name/tel/content required' }
      return
    }
    $item = [pscustomobject]@{
      id = ('lead-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + '-' + ([guid]::NewGuid().ToString('N').Substring(0,6)))
      name = $name.Substring(0, [Math]::Min(80, $name.Length))
      tel = $tel.Substring(0, [Math]::Min(40, $tel.Length))
      company = $company.Substring(0, [Math]::Min(120, $company.Length))
      content = $content.Substring(0, [Math]::Min(4000, $content.Length))
      createdAt = [DateTime]::UtcNow.ToString('o')
      source = 'contact'
      userAgent = ([string]$req.UserAgent)
    }
    $list = @(Read-Leads) + @($item)
    Write-Leads -Items $list
    Write-JsonResponse -Response $res -StatusCode 200 -Object @{ ok = $true; item = $item }
    return
  }

  if ($method -eq 'DELETE' -and $pathOnly -eq '/api/leads') {
    $id = [string]$req.QueryString['id']
    if (-not $id) {
      Write-JsonResponse -Response $res -StatusCode 400 -Object @{ error = 'missing id' }
      return
    }
    $list = @(Read-Leads)
    $next = @($list | Where-Object { $_.id -ne $id })
    if ($next.Count -eq $list.Count) {
      Write-JsonResponse -Response $res -StatusCode 404 -Object @{ error = 'not found' }
      return
    }
    Write-Leads -Items $next
    Write-JsonResponse -Response $res -StatusCode 200 -Object @{ ok = $true }
    return
  }

  Write-JsonResponse -Response $res -StatusCode 404 -Object @{ error = 'Not found' }
}

Ensure-UploadDirs

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host ('Cannot listen on ' + $prefix)
  Write-Host $_.Exception.Message
  exit 1
}

try {
  Start-Process $prefix | Out-Null
} catch {}

Write-Host ('Preview: ' + $prefix)
Write-Host ('Admin  : ' + $prefix + 'admin.html')
Write-Host 'Close this window to stop.'

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $absPath = $req.Url.AbsolutePath
    if ($absPath.StartsWith('/api/media')) {
      Handle-MediaApi -Context $ctx
    } elseif ($absPath.StartsWith('/api/leads')) {
      Handle-LeadsApi -Context $ctx
    } else {
      $rel = [System.Uri]::UnescapeDataString($absPath.TrimStart('/'))
      if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
      $rel = $rel.Replace('/', '\')
      $filePath = Join-Path $root $rel
      if (Test-Path -LiteralPath $filePath -PathType Container) {
        $filePath = Join-Path $filePath 'index.html'
      }
      if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        Write-TextResponse -Response $res -StatusCode 404 -Text ('404 Not Found: ' + $rel)
      } else {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
        if ($mimeMap.ContainsKey($ext)) {
          $res.ContentType = $mimeMap[$ext]
        } else {
          $res.ContentType = 'application/octet-stream'
        }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $res.ContentLength64 = $bytes.LongLength
        $res.Headers['Cache-Control'] = 'no-cache'
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      }
    }
  } catch {
    try { $res.StatusCode = 500 } catch {}
  } finally {
    try { $res.OutputStream.Close() } catch {}
  }
}
