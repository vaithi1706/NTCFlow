-- DKFlow — PostgreSQL setup script
-- Run as the `postgres` superuser via "SQL Shell (psql)" or pgAdmin.
--
-- BEFORE RUNNING: replace CHANGE-ME-STRONG-PASSWORD with a real password,
-- and put that same password in DATABASE_URL in apps\api\.env.
--
-- Tested on PostgreSQL 16, 17, and 18.

-- 1. Dedicated app role (don't run the app as postgres superuser in prod).
CREATE USER dkflow WITH PASSWORD 'CHANGE-ME-STRONG-PASSWORD';

-- 2. Database owned by that role.
CREATE DATABASE dkflow OWNER dkflow;

-- 3. Connect to the new database (still as postgres so we can install extensions).
\c dkflow

-- 4. pg_trgm — the only extension the Prisma schema declares.
-- Required for trigram indexes used by full-text-ish search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 5. Make sure the app user can use everything in public schema.
GRANT ALL PRIVILEGES ON SCHEMA public TO dkflow;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO dkflow;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO dkflow;

-- 6. Verify.
\dx
-- Expected output includes: pg_trgm
