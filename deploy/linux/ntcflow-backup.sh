#!/usr/bin/env bash
# NTCFlow nightly Postgres backup with rotation.
#
# What it does:
#   - pg_dump the `ntcflow` database to /home/ubuntu/backups/postgres/
#     as a gzip'd plain SQL file timestamped UTC.
#   - Authenticates via ~/.pgpass (chmod 600) -- no password in this script.
#   - Deletes dumps older than RETAIN_DAYS (default 14).
#   - Logs one line per run (also redirected to ~/backups/backup.log by cron).
#
# Install:
#   1. Put the matching password line in ~/.pgpass:
#         echo "localhost:5432:ntcflow:ntcflow:<your-pw>" >> ~/.pgpass
#         chmod 600 ~/.pgpass
#   2. Copy this script and chmod +x:
#         install -m 755 ntcflow-backup.sh /home/ubuntu/scripts/ntcflow-backup.sh
#   3. Schedule daily at 03:30 UTC (low-traffic window for US/IN):
#         ( crontab -l 2>/dev/null ; \
#           echo "30 3 * * * /home/ubuntu/scripts/ntcflow-backup.sh \
#                 >> /home/ubuntu/backups/backup.log 2>&1" ) | crontab -
#
# Restore:
#   # Pick a dump
#   ls /home/ubuntu/backups/postgres/
#
#   # Into the existing db (will fail if rows collide -- normally restore to a fresh db):
#   gunzip -c ntcflow_YYYYMMDD_HHMMSS.sql.gz | psql -h localhost -U ntcflow -d ntcflow
#
#   # Into a fresh db (safer):
#   sudo -u postgres createdb ntcflow_restore -O ntcflow
#   gunzip -c ntcflow_YYYYMMDD_HHMMSS.sql.gz | psql -h localhost -U ntcflow -d ntcflow_restore
#
# Future enhancement: upload the dump to S3 / Backblaze B2. Add 5 lines like:
#   aws s3 cp "$DUMP_FILE" "s3://your-bucket/postgres/$(basename "$DUMP_FILE")"
# right after the file is finalized, gated on `command -v aws` so this script
# stays usable without the AWS CLI installed.

set -euo pipefail

BACKUP_DIR=/home/ubuntu/backups/postgres
RETAIN_DAYS=14
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
DUMP_FILE="$BACKUP_DIR/ntcflow_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# --no-owner / --no-privileges keep the dump portable -- a restore into a
# database owned by a different role won't choke on permissions.
pg_dump -h localhost -U ntcflow -d ntcflow --no-owner --no-privileges \
  | gzip -9 > "$DUMP_FILE.tmp"
mv "$DUMP_FILE.tmp" "$DUMP_FILE"
chmod 600 "$DUMP_FILE"

# Rotate: remove dumps older than RETAIN_DAYS.
find "$BACKUP_DIR" -maxdepth 1 -name 'ntcflow_*.sql.gz' -type f \
  -mtime +"$RETAIN_DAYS" -delete

SIZE=$(du -h "$DUMP_FILE" | cut -f1)
COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -name 'ntcflow_*.sql.gz' -type f | wc -l)
echo "[$(date -Is)] ok  size=$SIZE  retained=$COUNT  file=$(basename "$DUMP_FILE")"
