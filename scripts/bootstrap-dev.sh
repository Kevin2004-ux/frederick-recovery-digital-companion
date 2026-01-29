#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:4000}"
EMAIL="${EMAIL:-kevin@test.com}"
PASSWORD="${PASSWORD:-Password123!}"
PROCEDURE_CODE="${PROCEDURE_CODE:-test-procedure}"
RECOVERY_START_DATE="${RECOVERY_START_DATE:-2026-01-28}"

log() { echo "$@" >&2; }

extract_token_node() {
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(j.token||'')}catch(e){process.stdout.write('')};});"
}

log "Bootstrapping dev session against $API_BASE for $EMAIL"

# Try login first, else signup
TOKEN="$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | extract_token_node
)"

if [ -z "$TOKEN" ]; then
  TOKEN="$(curl -s -X POST "$API_BASE/auth/signup" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
    | extract_token_node
  )"
fi

if [ -z "$TOKEN" ]; then
  log "Failed to get token from login/signup. Is the API running?"
  exit 1
fi

CONSENT_CODE="$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$API_BASE/auth/consent" \
  -H "Authorization: Bearer $TOKEN")"
log "Consent HTTP: $CONSENT_CODE"

ONBOARD_CODE="$(curl -s -o /dev/null -w "%{http_code}" \
  -X PUT "$API_BASE/user/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"procedureCode\":\"$PROCEDURE_CODE\",\"recoveryStartDate\":\"$RECOVERY_START_DATE\"}")"
log "Onboarding HTTP: $ONBOARD_CODE"

# IMPORTANT: stdout must be shell code if you run `source <(...)`
echo "export TOKEN=\"$TOKEN\""
