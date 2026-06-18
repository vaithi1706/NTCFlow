# DKFlow / NTCFlow -- Windows one-shot setup
#
# Run from anywhere; the script derives the repo root from its own location.
# Typical use, run as Administrator from the cloned repo root:
#
#   cd C:\Users\Administrator\Documents\GitHub\NTCFlow
#   .\deploy\windows\setup-all.ps1
#
# What this script does:
#   1. Verifies prerequisites (Node 22, pnpm, Git, NSSM, psql, Memurai/Redis)
#   2. Creates the Postgres user/database/pg_trgm extension if missing
#   3. Writes apps\api\.env with an auto-generated JWT_SECRET
#   4. pnpm install -> prisma generate -> prisma db push -> seed -> web build
#   5. Installs and starts dkflow-api and dkflow-web as Windows Services
#
# Flags:
#   -SkipPrereqCheck   skip the prerequisite probes
#   -SkipSeed          skip seeding demo data (alice/bob/carol/dave @dkflow.com)
#   -SkipBuild         skip the Next.js build (dev iteration)
#   -SkipServices      skip NSSM service install (you'll start manually)
#   -ReinstallServices stop+remove existing services before re-creating
#   -PostgresPassword  postgres superuser password (else prompts)
#   -DkflowDbPassword  password for the dkflow app DB user (else prompts)
#   -NvidiaApiKey      NVIDIA NIM API key for AI features (else prompts; optional)

[CmdletBinding()]
param(
    [switch]$SkipPrereqCheck,
    [switch]$SkipSeed,
    [switch]$SkipBuild,
    [switch]$SkipServices,
    [switch]$ReinstallServices,
    [string]$PostgresPassword,
    [string]$DkflowDbPassword,
    [string]$NvidiaApiKey
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repoRoot

function Header($s) { Write-Host "`n========== $s ==========" -ForegroundColor Cyan }
function Info($s)   { Write-Host "  $s" -ForegroundColor Gray }
function Ok($s)     { Write-Host "  [OK] $s" -ForegroundColor Green }
function Warn($s)   { Write-Host "  [WARN] $s" -ForegroundColor Yellow }
function Fail($s)   { Write-Host "  [FAIL] $s" -ForegroundColor Red; exit 1 }

function Get-SecureValue($prompt) {
    $sec = Read-Host $prompt -AsSecureString
    [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
}

# --- Repo root ---------------------------------------------------
Header "Repo: $repoRoot"

# --- Admin check (needed for service install) --------------------
if (-not $SkipServices) {
    $isAdmin = ([Security.Principal.WindowsPrincipal] `
        [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Fail "Run as Administrator (service install requires elevation). Or pass -SkipServices."
    }
}

# --- Step 1: Prereqs ---------------------------------------------
Header "Step 1/5: Prerequisites"
if (-not $SkipPrereqCheck) {

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Fail "Node not found. Install Node 22 LTS from https://nodejs.org"
    }
    $nodeMajor = [int]((& node -v) -replace '^v(\d+)\..*', '$1')
    if ($nodeMajor -lt 22) { Fail "Need Node >= 22; found $nodeMajor" }
    Ok "Node $(& node -v)"

    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Fail "pnpm not found. Install: npm i -g pnpm@10.29.3"
    }
    Ok "pnpm $(& pnpm -v)"

    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail "Git not found." }
    Ok "Git on PATH"

    if (-not $SkipServices) {
        if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) {
            Fail "NSSM not found. Install: winget install NSSM.NSSM"
        }
        Ok "NSSM on PATH"
    }

    if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
        Fail "psql not on PATH. Install PostgreSQL 16+ (EnterpriseDB) and ensure C:\Program Files\PostgreSQL\<ver>\bin is on PATH."
    }
    Ok "psql on PATH"

    # Redis: Memurai (Windows-native) preferred, fall back to redis-cli on PATH.
    $memurai = "C:\Program Files\Memurai\memurai-cli.exe"
    if (Test-Path $memurai) {
        $ping = & $memurai ping 2>$null
        if ($ping -ne "PONG") { Fail "Memurai service not responding. Start-Service Memurai" }
        Ok "Memurai PONG"
    } elseif (Get-Command redis-cli -ErrorAction SilentlyContinue) {
        $ping = & redis-cli ping 2>$null
        if ($ping -ne "PONG") { Fail "redis-cli found but server not responding." }
        Ok "Redis (redis-cli) PONG"
    } else {
        Fail "Memurai not installed. Get it: https://www.memurai.com/get-memurai"
    }
} else {
    Warn "Skipping prereq check (-SkipPrereqCheck)"
}

# --- Step 2: Database --------------------------------------------
Header "Step 2/5: Database"

if (-not $PostgresPassword) {
    $PostgresPassword = Get-SecureValue "Enter postgres SUPERUSER password"
}
$env:PGPASSWORD = $PostgresPassword

$test = & psql -U postgres -h localhost -d postgres -tAc "select 1" 2>&1
if ($LASTEXITCODE -ne 0) {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Fail "Cannot connect to postgres as 'postgres' user: $test"
}
Ok "Postgres connection OK"

$dbExists = & psql -U postgres -h localhost -d postgres -tAc "select 1 from pg_database where datname='dkflow'" 2>$null
if ($dbExists.Trim() -eq "1") {
    Warn "Database 'dkflow' already exists -- leaving it alone"
    if (-not $DkflowDbPassword) {
        $DkflowDbPassword = Get-SecureValue "Enter the existing dkflow app user password (for .env)"
    }
} else {
    if (-not $DkflowDbPassword) {
        $DkflowDbPassword = Get-SecureValue "Pick a password for the new dkflow APP USER"
    }
    # Single-quote-escape the password for the SQL literal.
    $escaped = $DkflowDbPassword.Replace("'", "''")
    & psql -U postgres -h localhost -d postgres -c "CREATE USER dkflow WITH PASSWORD '$escaped'" | Out-Null
    & psql -U postgres -h localhost -d postgres -c "CREATE DATABASE dkflow OWNER dkflow" | Out-Null
    & psql -U postgres -h localhost -d dkflow -c "CREATE EXTENSION IF NOT EXISTS pg_trgm" | Out-Null
    & psql -U postgres -h localhost -d dkflow -c "GRANT ALL PRIVILEGES ON SCHEMA public TO dkflow" | Out-Null
    & psql -U postgres -h localhost -d dkflow -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO dkflow" | Out-Null
    & psql -U postgres -h localhost -d dkflow -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO dkflow" | Out-Null
    Ok "Created dkflow database with pg_trgm + grants"
}

Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

# --- Step 3: .env files ------------------------------------------
Header "Step 3/5: Environment files"

$apiEnv = Join-Path $repoRoot "apps\api\.env"
$webEnv = Join-Path $repoRoot "apps\web\.env.production.local"
$uploadDir = Join-Path $repoRoot "uploads"

if (Test-Path $apiEnv) {
    Warn "apps\api\.env already exists -- keeping it (delete to regenerate)"
} else {
    if (-not $NvidiaApiKey) {
        $NvidiaApiKey = Read-Host "NVIDIA_API_KEY (press Enter to skip; AI chat/insights will be disabled until set)"
        if (-not $NvidiaApiKey) { $NvidiaApiKey = "nvapi-CHANGE-ME" }
    }

    Info "Generating 96-char JWT_SECRET..."
    $jwtBytes = New-Object byte[] 48
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($jwtBytes)
    $rng.Dispose()
    $jwtSecret = -join ($jwtBytes | ForEach-Object { $_.ToString('x2') })

    $apiEnvContent = @"
# Generated by deploy\windows\setup-all.ps1 -- edit as needed.
NODE_ENV=production
APP_URL=http://localhost
API_URL=http://localhost
PORT=4000

DATABASE_URL=postgresql://dkflow:$DkflowDbPassword@localhost:5432/dkflow
REDIS_URL=redis://localhost:6379

JWT_SECRET=$jwtSecret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
BCRYPT_ROUNDS=12

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=change-me
EMAIL_FROM="DKFlow <noreply@example.com>"

UPLOAD_DIR=$uploadDir
MAX_FILE_SIZE=26214400

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

NVIDIA_API_KEY=$NvidiaApiKey
"@
    Set-Content -Path $apiEnv -Value $apiEnvContent -Encoding UTF8
    Ok "Wrote apps\api\.env"
}

if (-not (Test-Path $webEnv)) {
    Set-Content -Path $webEnv -Value "NEXT_PUBLIC_API_URL=http://localhost`n" -Encoding UTF8
    Ok "Wrote apps\web\.env.production.local"
} else {
    Warn "apps\web\.env.production.local already exists -- keeping it"
}

if (-not (Test-Path $uploadDir)) {
    New-Item -ItemType Directory -Path $uploadDir -Force | Out-Null
    Ok "Created uploads dir: $uploadDir"
}

# --- Step 4: Deploy ----------------------------------------------
Header "Step 4/5: pnpm install + Prisma + build"

$deployArgs = @()
if ($SkipSeed)  { $deployArgs += "-SkipSeed" }
if ($SkipBuild) { $deployArgs += "-SkipBuild" }
& (Join-Path $PSScriptRoot "02-deploy-app.ps1") @deployArgs
if ($LASTEXITCODE -ne 0) { Fail "Deploy step failed (see output above)" }

# --- Step 5: Services --------------------------------------------
if ($SkipServices) {
    Warn "Skipping NSSM service install (-SkipServices)"
} else {
    Header "Step 5/5: Windows Services (NSSM)"
    $serviceArgs = @()
    if ($ReinstallServices) { $serviceArgs += "-Reinstall" }
    & (Join-Path $PSScriptRoot "03-install-services.ps1") @serviceArgs
    if ($LASTEXITCODE -ne 0) { Fail "Service install failed (see output above)" }
}

# --- Health check ------------------------------------------------
if (-not $SkipServices) {
    Header "Health check"
    Start-Sleep -Seconds 4
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:4000/api/health" -TimeoutSec 6
        if ($health.status -eq "ok") { Ok "API: $($health | ConvertTo-Json -Compress)" }
        else { Warn "API responded but status not ok: $($health | ConvertTo-Json -Compress)" }
    } catch {
        Warn "API not yet responding: $($_.Exception.Message)"
        Warn "Check: Get-Service dkflow-api  ;  Get-Content logs\dkflow-api.err.log -Tail 30"
    }

    try {
        $web = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 6 -UseBasicParsing
        Ok "Web: HTTP $($web.StatusCode)"
    } catch {
        Warn "Web not yet responding: $($_.Exception.Message)"
    }
}

# --- Summary -----------------------------------------------------
Header "Done"
Write-Host "  Local:    http://localhost:3000" -ForegroundColor Green
Write-Host "  API:      http://localhost:4000/api/health" -ForegroundColor Green
if (-not $SkipSeed) {
    Write-Host "  Login:    alice.chen@dkflow.com / Password1!" -ForegroundColor Green
}
Write-Host ""
Write-Host "Next:" -ForegroundColor Yellow
Write-Host "  - Configure IIS reverse proxy (see deploy\windows\README.md  Step 6)"
Write-Host "  - Bind your domain + SSL via win-acme: https://www.win-acme.com/"
Write-Host "  - Pro license key (optional): .\deploy\windows\generate-license-key.ps1"
