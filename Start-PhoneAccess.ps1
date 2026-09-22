param(
    [ValidateRange(1,65535)][int]$Port = 8080,
    [string]$CloudflaredPath
)
$ErrorActionPreference = 'Stop'
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 5
    if ($health.status -ne 'ok') { throw 'Unexpected health response.' }
} catch { throw "Start ISL Bridge first with .\Start-ISLBridge.ps1 -Port $Port and wait for Started, then retry Phone Access." }

if (-not $CloudflaredPath) {
    $installed = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($installed) { $CloudflaredPath = $installed.Source }
    else {
        $cachePath = Join-Path $PSScriptRoot '.cache/phone-access'
        New-Item -ItemType Directory -Path $cachePath -Force | Out-Null
        $CloudflaredPath = Join-Path $cachePath 'cloudflared.exe'
        $checksumPath = Join-Path $cachePath 'cloudflared.sha256'
        $cachedValid = (Test-Path -LiteralPath $CloudflaredPath) -and (Test-Path -LiteralPath $checksumPath)
        if ($cachedValid) { $cachedValid = (Get-FileHash -LiteralPath $CloudflaredPath -Algorithm SHA256).Hash -eq (Get-Content -LiteralPath $checksumPath -Raw).Trim() }
        if (-not $cachedValid) {
            Write-Host 'Downloading the official Cloudflare tunnel utility into the ignored local cache...'
            $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest' -Headers @{ 'User-Agent' = 'ISL-Bridge-Phone-Access' }
            $assetName = if ([Environment]::Is64BitOperatingSystem) { 'cloudflared-windows-amd64.exe' } else { 'cloudflared-windows-386.exe' }
            $asset = $release.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1
            if (-not $asset -or $asset.digest -notmatch '^sha256:[a-fA-F0-9]{64}$') { throw 'The release has no verifiable SHA256 digest. Install cloudflared from its official site and retry with -CloudflaredPath.' }
            $downloadPath = Join-Path $cachePath 'cloudflared.download'
            Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $downloadPath
            $expectedHash = $asset.digest.Substring(7)
            if ((Get-FileHash -LiteralPath $downloadPath -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Cloudflared download checksum mismatch. Nothing was executed.' }
            Move-Item -LiteralPath $downloadPath -Destination $CloudflaredPath -Force
            Set-Content -LiteralPath $checksumPath -Value $expectedHash
        }
    }
}
if (-not (Test-Path -LiteralPath $CloudflaredPath -PathType Leaf)) { throw 'CloudflaredPath must point to the installed cloudflared executable.' }
Write-Host "Sharing only the ISL Bridge server on port $Port through a temporary HTTPS tunnel." -ForegroundColor Cyan
Write-Host 'When the https://...trycloudflare.com address appears below:'
Write-Host '  1. Open that address with /official.html on the laptop. Reclaim your existing counter code, or create a new counter.'
Write-Host '  2. Scan its QR on Android and open in Chrome. Tap Start / retry camera and Allow.'
Write-Host '  Alternatively paste the HTTPS base address into the phone-link setting on the local official screen.'
Write-Host 'Keep this window and the backend window open. Ctrl+C ends sharing. Each restart produces a new URL.'
Write-Host 'This is temporary demonstration access, not authenticated public deployment. Share the URL only with demonstration participants.'
# An empty task-specific config prevents a user's named-tunnel config overriding quick mode.
$configPath = Join-Path $PSScriptRoot '.cache/phone-access/quick-config.yml'
New-Item -ItemType Directory -Path (Split-Path $configPath) -Force | Out-Null
Set-Content -LiteralPath $configPath -Value '{}'
& $CloudflaredPath tunnel --config $configPath --url "http://127.0.0.1:$Port" --no-autoupdate --protocol http2
if ($LASTEXITCODE -ne 0) { throw 'Phone tunnel stopped. Check the connection and the tunnel error above.' }
