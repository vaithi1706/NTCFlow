# NTCFlow — Linux deployment helpers

Scripts and recipes for the Ubuntu/Lightsail/EC2 deployment.

## Contents

| File | Purpose |
|---|---|
| [`ntcflow-backup.sh`](ntcflow-backup.sh) | Nightly Postgres dump → gzip → rotation. 14-day retention. Cron-friendly. |

## Backup install (one-time, per host)

```bash
# 1. Auth file -- put the dkflow/ntcflow password in here so pg_dump can run
#    non-interactively. Match the password to whatever DATABASE_URL uses.
echo "localhost:5432:ntcflow:ntcflow:$(grep ^DATABASE_URL= /home/ubuntu/ntcflow/apps/api/.env \
       | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')" > ~/.pgpass
chmod 600 ~/.pgpass

# 2. Install the script
mkdir -p /home/ubuntu/scripts /home/ubuntu/backups/postgres
chmod 700 /home/ubuntu/backups
install -m 755 deploy/linux/ntcflow-backup.sh /home/ubuntu/scripts/

# 3. Verify it runs
/home/ubuntu/scripts/ntcflow-backup.sh
ls -lh /home/ubuntu/backups/postgres/

# 4. Schedule daily at 03:30 UTC
( crontab -l 2>/dev/null
  echo "30 3 * * * /home/ubuntu/scripts/ntcflow-backup.sh >> /home/ubuntu/backups/backup.log 2>&1"
) | crontab -
```

## Where backups live

- **Dumps**: `/home/ubuntu/backups/postgres/ntcflow_YYYYMMDD_HHMMSS.sql.gz`
- **Run log**: `/home/ubuntu/backups/backup.log` (one line per run)
- **Retention**: 14 days (configurable in the script — `RETAIN_DAYS`)

## Restore

Pick a dump from `backups/postgres/`, then **into a fresh DB** (safer than into the live one):

```bash
sudo -u postgres createdb ntcflow_restore -O ntcflow
gunzip -c /home/ubuntu/backups/postgres/ntcflow_20260626_034500.sql.gz \
  | psql -h localhost -U ntcflow -d ntcflow_restore
# inspect it, then swap by renaming when you're sure
```

Direct restore into the live DB is possible but usually wrong — `pg_dump` plain output expects an empty target.

## Future: off-host backups (S3 / B2)

The current setup protects against pg corruption and accidental DELETEs, **not** disk loss. To survive a Lightsail SSD failure, add:

```bash
aws s3 cp "$DUMP_FILE" "s3://your-bucket/ntcflow/$(basename "$DUMP_FILE")"
```

right after the `mv "$DUMP_FILE.tmp" "$DUMP_FILE"` line in `ntcflow-backup.sh`. Wrap in `if command -v aws`, so the script still runs cleanly on hosts that don't have the AWS CLI installed.

You'd also need:
- AWS CLI installed (`apt install awscli`)
- An IAM user with `s3:PutObject` on the bucket
- That user's credentials in `~/.aws/credentials`

Lightsail's "Object Storage" service speaks the S3 API — same setup, point the endpoint at Lightsail.
