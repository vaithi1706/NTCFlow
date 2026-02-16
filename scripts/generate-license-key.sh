#!/bin/bash
# DKFlow License Key Generator
# Usage: ./generate-license-key.sh [duration_days] [note]
# Examples:
#   ./generate-license-key.sh              # 365 days, no note
#   ./generate-license-key.sh 30 "Test key"
#   ./generate-license-key.sh 365 "Lokesh Pro"

DURATION=${1:-365}
NOTE=${2:-"Admin generated"}
DB="postgresql://postgres:dkflow123@localhost:5432/dkflow"

# Generate key: DK-XXXXXXXX-XXXXXXXX
PART1=$(openssl rand -hex 4 | tr 'a-f' 'A-F')
PART2=$(openssl rand -hex 4 | tr 'a-f' 'A-F')
KEY="DK-${PART1}-${PART2}"
ID=$(uuidgen)

psql "$DB" -q -c "
INSERT INTO \"LicenseKeys\" (\"Id\", \"Key\", \"Plan\", \"BillingCycle\", \"DurationDays\", \"MaxUses\", \"UsedCount\", \"IsActive\", \"Note\", \"CreatedAt\")
VALUES ('$ID', '$KEY', 'pro', 'yearly', $DURATION, 1, 0, true, '$NOTE', NOW());
"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ License key generated!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Key:      $KEY"
  echo "  Plan:     Pro"
  echo "  Duration: $DURATION days"
  echo "  Note:     $NOTE"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
else
  echo "❌ Failed to generate key"
  exit 1
fi
