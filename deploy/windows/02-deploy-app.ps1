# DKFlow — Windows deploy script
# Runs install + Prisma + seed + web build. Idempotent: safe to re-run.
#
# Usage (from C:\dkflow):
#   .\deploy\windows\02-deploy-app.ps1
#   .\deploy\windows\02-deploy-app.ps1 -SkipSeed     # if you've already seeded
#   .\deploy\windows\02-deploy-app.ps1 -SkipBuild    # dev iteration only

param(
    [switch]$SkipSeed,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repoRoot

function Step($name) { Write-Host "`n=== $name ===" -ForegroundColor Cyan }

# --- Preflight ---------------------------------------------------
Step "Preflight"

if (-not (Test-Path ".\apps\api\.env")) {
    Write-Host "ERROR: apps\api\.env is missing." -ForegroundColor Red
    Write-Host "Copy the template and fill in the secrets first:"
    Write-Host "  Copy-Item .\deploy\windows\api.env.example .\apps\api\.env"
    Write-Host "  notepad .\apps\api\.env"
    exit 1
}

foreach ($cmd in @("node", "pnpm", "git")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: '$cmd' not found on PATH." -ForegroundColor Red
        exit 1
    }
}

$nodeMajor = [int]((& node -v) -replace '^v(\d+)\..*', '$1')
if ($nodeMajor -lt 22) {
    Write-Host "ERROR: Node $nodeMajor detected; need >= 22." -ForegroundColor Red
    exit 1
}

# Make the uploads dir before the API tries to mkdir it on startup.
$uploadDir = "C:\dkflow\uploads"
if (-not (Test-Path $uploadDir)) { New-Item -ItemType Directory -Path $uploadDir -Force | Out-Null }

# Logs dir for NSSM.
if (-not (Test-Path ".\logs")) { New-Item -ItemType Directory -Path ".\logs" | Out-Null }

# --- Install deps ------------------------------------------------
Step "pnpm install"
pnpm install --frozen-lockfile

# --- Prisma ------------------------------------------------------
Step "prisma generate"
pnpm --filter "@dkflow/api" exec prisma generate

Step "prisma db push"
pnpm --filter "@dkflow/api" exec prisma db push

if (-not $SkipSeed) {
    Step "Seed (4 demo users, 1 workspace, 3 projects, 10 tasks, sprint)"
    Push-Location ".\apps\api"
    try { pnpm exec tsx prisma\seed.ts } finally { Pop-Location }
} else {
    Write-Host "  (skipped — -SkipSeed)" -ForegroundColor Yellow
}

# --- Web build ---------------------------------------------------
if (-not $SkipBuild) {
    Step "Web build"
    pnpm --filter "@dkflow/web" build
} else {
    Write-Host "  (skipped — -SkipBuild)" -ForegroundColor Yellow
}

Step "Done"
Write-Host "Next: install services with .\deploy\windows\03-install-services.ps1" -ForegroundColor Green
