# DKFlow — install API and Web as Windows Services via NSSM.
# Must be run as Administrator.
#
# Usage (from C:\dkflow):
#   .\deploy\windows\03-install-services.ps1
#   .\deploy\windows\03-install-services.ps1 -Reinstall   # stops, removes, re-creates

param(
    [switch]$Reinstall,
    # Default to the repo root derived from this script's location, so the
    # script works from any clone path (e.g. C:\Users\Administrator\Documents\GitHub\NTCFlow).
    [string]$AppRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
)

$ErrorActionPreference = "Stop"

# Must be admin.
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: must run as Administrator (services need elevation)." -ForegroundColor Red
    exit 1
}

$nssm = (Get-Command nssm -ErrorAction SilentlyContinue).Source
if (-not $nssm) {
    Write-Host "ERROR: nssm not found on PATH. Install: winget install NSSM.NSSM" -ForegroundColor Red
    exit 1
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
    Write-Host "ERROR: node not found on PATH." -ForegroundColor Red
    exit 1
}

$logsDir = Join-Path $AppRoot "logs"
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }

function Install-DkflowService {
    param($Name, $DisplayName, $Description, $WorkingDir, $Script, $Args)

    if (Get-Service $Name -ErrorAction SilentlyContinue) {
        if ($Reinstall) {
            Write-Host "Removing existing service $Name..." -ForegroundColor Yellow
            & $nssm stop $Name confirm | Out-Null
            & $nssm remove $Name confirm | Out-Null
        } else {
            Write-Host "Service $Name already exists. Use -Reinstall to recreate." -ForegroundColor Yellow
            return
        }
    }

    Write-Host "Installing $Name..." -ForegroundColor Cyan
    & $nssm install $Name $node $Script $Args | Out-Null
    & $nssm set $Name AppDirectory $WorkingDir | Out-Null
    & $nssm set $Name DisplayName $DisplayName | Out-Null
    & $nssm set $Name Description $Description | Out-Null
    & $nssm set $Name Start SERVICE_AUTO_START | Out-Null
    & $nssm set $Name AppStdout (Join-Path $logsDir "$Name.log") | Out-Null
    & $nssm set $Name AppStderr (Join-Path $logsDir "$Name.err.log") | Out-Null
    # Rotate logs: 10MB per file, keep them.
    & $nssm set $Name AppRotateFiles 1 | Out-Null
    & $nssm set $Name AppRotateBytes 10485760 | Out-Null
    # Restart on crash with a short delay; back off to 30s.
    & $nssm set $Name AppRestartDelay 2000 | Out-Null
    & $nssm set $Name AppThrottle 5000 | Out-Null
}

# --- API ---------------------------------------------------------
# Mirrors ecosystem.config.js (which runs tsx on src/index.ts).
# .env is loaded by `import "dotenv/config"` at the top of src/index.ts.
Install-DkflowService `
    -Name "dkflow-api" `
    -DisplayName "DKFlow API" `
    -Description "DKFlow Express + tRPC backend (port 4000)" `
    -WorkingDir (Join-Path $AppRoot "apps\api") `
    -Script "node_modules\tsx\dist\cli.mjs" `
    -Args "src\index.ts"

# --- Web ---------------------------------------------------------
# `next start` reads .env.production.local from the cwd automatically.
Install-DkflowService `
    -Name "dkflow-web" `
    -DisplayName "DKFlow Web" `
    -Description "DKFlow Next.js frontend (port 3000)" `
    -WorkingDir (Join-Path $AppRoot "apps\web") `
    -Script "node_modules\next\dist\bin\next" `
    -Args "start -p 3000"

# --- Start -------------------------------------------------------
Write-Host "`nStarting services..." -ForegroundColor Cyan
Start-Service dkflow-api
Start-Service dkflow-web

Start-Sleep -Seconds 6
Get-Service dkflow-api, dkflow-web | Format-Table Name, Status, StartType

Write-Host "`nLogs: $logsDir" -ForegroundColor Green
Write-Host "API health: curl http://localhost:4000/api/health" -ForegroundColor Green
Write-Host "Web: curl http://localhost:3000" -ForegroundColor Green
