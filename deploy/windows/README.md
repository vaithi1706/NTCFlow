# DKFlow — Windows Server Deployment

Step-by-step guide for deploying DKFlow on a fresh Windows Server (2019 / 2022 / 2025).

Assumes:
- App lives at `C:\dkflow`
- Reverse proxy: **IIS** with URL Rewrite + ARR + WebSockets
- Process manager: **NSSM** (services run as Windows Services)
- DB: PostgreSQL 16+ (18.x verified)
- Redis: **Memurai** (Windows-native, Redis-protocol compatible)

---

## Fast path — one command

Once the runtimes are installed (Step 1 below), run as **Administrator**:

```powershell
cd C:\Users\Administrator\Documents\GitHub\NTCFlow   # or wherever you cloned it
.\deploy\windows\setup-all.ps1
```

That single script does Steps 2–5: creates the DB, generates the `.env` (with auto-generated JWT_SECRET), installs deps, runs Prisma, seeds, builds, and installs the Windows Services. Step 6 (IIS) is still manual.

## Order of operations

| # | Step | File |
|---|---|---|
| 1 | Install runtimes (Postgres, Memurai, Node 22 LTS, pnpm, Git, NSSM) | — |
| 2–5 | **One-shot setup** (DB + env + deps + Prisma + seed + build + services) | [`setup-all.ps1`](setup-all.ps1) |
| | — or do the substeps manually: | |
| 2 | Create the DB, user, extension | [`01-setup-db.sql`](01-setup-db.sql) |
| 3 | Write the `.env` files | [`api.env.example`](api.env.example), [`web.env.production.local.example`](web.env.production.local.example) |
| 4 | Install deps, run Prisma, build | [`02-deploy-app.ps1`](02-deploy-app.ps1) |
| 5 | Install API + Web as Windows Services | [`03-install-services.ps1`](03-install-services.ps1) |
| 6 | Configure IIS reverse proxy with WebSocket support | [`iis-web.config`](iis-web.config) |
| 7 | (Optional) Generate a Pro license key | [`generate-license-key.ps1`](generate-license-key.ps1) |

---

## Step 1 — Install runtimes

Run in **PowerShell as Administrator**:

```powershell
# Node 22 LTS
winget install OpenJS.NodeJS.LTS

# Git
winget install Git.Git

# NSSM (Non-Sucking Service Manager) — wraps node as a Windows Service
winget install NSSM.NSSM

# pnpm @ the exact version this monorepo expects
npm i -g pnpm@10.29.3
```

Manual installs (no reliable winget package):
- **PostgreSQL 18.x** — [EnterpriseDB installer](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads). Defaults are fine; remember the `postgres` superuser password.
- **Memurai Developer** — https://www.memurai.com/get-memurai. Installs as a Windows Service on `localhost:6379`.
- **IIS + URL Rewrite + ARR**: see Step 6.

Verify:
```powershell
node -v        # v22.x
pnpm -v        # 10.29.3
psql --version # 18.x
"C:\Program Files\Memurai\memurai-cli.exe" ping  # PONG
```

---

## Step 2 — DB setup

Open **SQL Shell (psql)** from the Start menu (installed with Postgres). Log in as `postgres`.

Run [`01-setup-db.sql`](01-setup-db.sql) — open it, replace `CHANGE-ME-STRONG-PASSWORD` with a real password, and paste into psql. It creates the `dkflow` user/db and enables `pg_trgm`.

Note the password — you'll need it in Step 4.

---

## Step 3 — Clone + install + seed

PowerShell, **non-admin** (don't pollute system PATH with admin-shell habits):

```powershell
cd C:\
git clone https://github.com/<your-org>/dkflow.git dkflow
cd C:\dkflow
.\deploy\windows\02-deploy-app.ps1
```

The script does: `pnpm install`, `prisma generate`, `prisma db push`, seed, web build. Stops with a clear error if `apps\api\.env` is missing — write it first (Step 4) if so.

---

## Step 4 — Environment files

Copy the templates and edit:

```powershell
Copy-Item .\deploy\windows\api.env.example .\apps\api\.env
Copy-Item .\deploy\windows\web.env.production.local.example .\apps\web\.env.production.local
notepad .\apps\api\.env
notepad .\apps\web\.env.production.local
```

Fill in:
- `DATABASE_URL` — with the password from Step 2
- `JWT_SECRET` — generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `NVIDIA_API_KEY` — from your NVIDIA NIM account (for AI chat / embeddings / insights / Teams summaries)
- `SMTP_*` — your transactional email provider
- `APP_URL`, `API_URL`, `NEXT_PUBLIC_API_URL` — your final public URL (e.g. `https://dkflow.yourcompany.com`)

Then run Step 3 if you hadn't already.

---

## Step 5 — Install services

```powershell
.\deploy\windows\03-install-services.ps1
```

This installs two services: `dkflow-api` (port 4000) and `dkflow-web` (port 3000), both bound to localhost.

Verify:
```powershell
Get-Service dkflow-*
# Status   Name        DisplayName
# ------   ----        -----------
# Running  dkflow-api  DKFlow API
# Running  dkflow-web  DKFlow Web

curl http://localhost:4000/api/health
# {"status":"ok",...}
```

Logs land in `C:\dkflow\logs\`.

---

## Step 6 — IIS reverse proxy

Install the IIS features (PowerShell as Admin):
```powershell
Install-WindowsFeature -Name Web-Server, Web-WebSockets
```

Install the two add-on modules (download MSIs from Microsoft):
- **URL Rewrite 2.1** — https://www.iis.net/downloads/microsoft/url-rewrite
- **Application Request Routing 3.0** — https://www.iis.net/downloads/microsoft/application-request-routing

After ARR install, enable proxy: **IIS Manager** → server node → **Application Request Routing Cache** → **Server Proxy Settings** → check **Enable proxy** → Apply.

Create the site:
```powershell
New-Item -Path C:\inetpub\dkflow -ItemType Directory -Force
Copy-Item .\deploy\windows\iis-web.config C:\inetpub\dkflow\web.config
New-WebSite -Name "dkflow" -PhysicalPath "C:\inetpub\dkflow" -Port 80
```

For HTTPS: use [win-acme](https://www.win-acme.com/) to install a Let's Encrypt cert and bind it to the site on 443. (Or import a commercial cert into the Windows Certificate Store and bind it via IIS Manager.)

---

## Step 7 — Pro license key (optional)

If you want a Pro license key for the workspace:
```powershell
.\deploy\windows\generate-license-key.ps1 -DurationDays 365 -Note "Production key"
```

Redeem it via the **Pricing → Activate License Key** flow in the app, signed in as the workspace owner.

---

## Updates / redeploy

After a `git pull`:
```powershell
cd C:\dkflow
pnpm install
pnpm --filter @dkflow/api exec prisma generate
pnpm --filter @dkflow/api exec prisma db push   # only if schema changed
pnpm --filter @dkflow/web build
Restart-Service dkflow-api, dkflow-web
```

---

## Pre-prod cleanup (worth knowing)

A few items from the local-dev session are worth applying before production:

1. **Unhandled promise rejection in `ai.chat`** ([apps/api/src/routers/ai.router.ts:799](../../apps/api/src/routers/ai.router.ts)) — `generateSessionTitle(...).then(...)` has no `.catch()`. If the NVIDIA call rejects on a new chat session, the entire Node process crashes. One-line fix: `.catch(() => {})` on the outer promise. **Apply this before prod traffic.**

2. **Hardcoded `/home/ubuntu/dkflow/uploads`** — already patched to honor `UPLOAD_DIR`. The Windows `.env` sets it to `C:\dkflow\uploads`, so the Linux fallback never runs.

3. **`scripts/generate-license-key.sh`** has a hardcoded DB password from a prior environment. Use `generate-license-key.ps1` (this folder) instead — it reads `DATABASE_URL` from `apps\api\.env`.
