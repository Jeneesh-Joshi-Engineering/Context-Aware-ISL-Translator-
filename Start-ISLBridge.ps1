param([int]$Port = 8080)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
foreach ($tool in @('node', 'npm', 'java', 'mvn')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool is not installed or is missing from PATH." }
}
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
    throw "Port $Port is already in use. Stop the previous server with Ctrl+C or run with -Port 8081."
}
if (-not (Test-Path -LiteralPath 'node_modules/@tensorflow/tfjs/package.json')) {
    npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
npm run assets
if ($LASTEXITCODE -ne 0) { throw 'Browser asset preparation failed.' }
$env:SERVER_PORT = "$Port"
Write-Host "Starting ISL Bridge. When Spring reports Started, open http://localhost:$Port/official.html" -ForegroundColor Cyan
Write-Host 'Signer: /index.html | Full pipeline check: /diagnostics.html | Stop: Ctrl+C'
Set-Location -LiteralPath (Join-Path $PSScriptRoot 'isl-translator/backend')
mvn spring-boot:run
if ($LASTEXITCODE -ne 0) { throw 'Backend did not start. Read the Maven error above.' }
