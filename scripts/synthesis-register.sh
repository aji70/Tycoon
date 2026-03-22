#!/usr/bin/env bash
# Synthesis hackathon registration via API (https://synthesis.md/skill.md).
# Run on YOUR machine only. Do not commit secrets or apiKey.
#
# Usage:
#   1. Copy: cp scripts/synthesis-register.env.example scripts/synthesis-register.local.env  (in repo: scripts/)
#   2. Edit synthesis-register.local.env with your real values
#   3. source scripts/synthesis-register.local.env && bash scripts/synthesis-register.sh init
#   4. bash scripts/synthesis-register.sh email-send    # uses PENDING_ID from step 3
#   5. bash scripts/synthesis-register.sh email-confirm  # prompts for OTP
#   6. bash scripts/synthesis-register.sh complete
#
set -euo pipefail
BASE="${SYNTHESIS_API_BASE:-https://synthesis.devfolio.co}"

load_env() {
  local f="${BASH_SOURCE[0]%/*}/synthesis-register.local.env"
  if [[ -f "$f" ]]; then
    # shellcheck source=/dev/null
    set -a && source "$f" && set +a
  fi
}

step_init() {
  load_env
  : "${AGENT_NAME:?Set AGENT_NAME}"
  : "${AGENT_DESCRIPTION:?Set AGENT_DESCRIPTION}"
  : "${AGENT_HARNESS:?Set AGENT_HARNESS e.g. cursor}"
  : "${AGENT_MODEL:?Set AGENT_MODEL e.g. claude-sonnet-4-6}"
  : "${HUMAN_NAME:?Set HUMAN_NAME}"
  : "${HUMAN_EMAIL:?Set HUMAN_EMAIL}"
  : "${HUMAN_BACKGROUND:?Set HUMAN_BACKGROUND e.g. Builder}"
  : "${HUMAN_CRYPTO_EXP:?Set HUMAN_CRYPTO_EXP yes|no|a little}"
  : "${HUMAN_AI_EXP:?Set HUMAN_AI_EXP yes|no|a little}"
  : "${HUMAN_CODING_COMFORT:?Set HUMAN_CODING_COMFORT 1-10}"
  : "${HUMAN_PROBLEM:?Set HUMAN_PROBLEM}"

  local body
  body=$(AGENT_NAME="$AGENT_NAME" AGENT_DESCRIPTION="$AGENT_DESCRIPTION" AGENT_HARNESS="$AGENT_HARNESS" AGENT_MODEL="$AGENT_MODEL" \
    HUMAN_NAME="$HUMAN_NAME" HUMAN_EMAIL="$HUMAN_EMAIL" HUMAN_BACKGROUND="$HUMAN_BACKGROUND" \
    HUMAN_CRYPTO_EXP="$HUMAN_CRYPTO_EXP" HUMAN_AI_EXP="$HUMAN_AI_EXP" HUMAN_CODING_COMFORT="$HUMAN_CODING_COMFORT" \
    HUMAN_PROBLEM="$HUMAN_PROBLEM" HUMAN_SOCIAL="${HUMAN_SOCIAL:-}" TEAM_CODE="${TEAM_CODE:-}" python3 <<'PY'
import json, os
hi = {
  "name": os.environ["HUMAN_NAME"],
  "email": os.environ["HUMAN_EMAIL"],
  "background": os.environ["HUMAN_BACKGROUND"],
  "cryptoExperience": os.environ["HUMAN_CRYPTO_EXP"],
  "aiAgentExperience": os.environ["HUMAN_AI_EXP"],
  "codingComfort": int(os.environ["HUMAN_CODING_COMFORT"]),
  "problemToSolve": os.environ["HUMAN_PROBLEM"],
}
if os.environ.get("HUMAN_SOCIAL"):
  hi["socialMediaHandle"] = os.environ["HUMAN_SOCIAL"]
payload = {
  "name": os.environ["AGENT_NAME"],
  "description": os.environ["AGENT_DESCRIPTION"],
  "agentHarness": os.environ["AGENT_HARNESS"],
  "model": os.environ["AGENT_MODEL"],
  "humanInfo": hi,
}
if os.environ.get("TEAM_CODE"):
  payload["teamCode"] = os.environ["TEAM_CODE"]
print(json.dumps(payload))
PY
)

  echo "POST $BASE/register/init ..."
  resp=$(curl -sS -X POST "$BASE/register/init" -H "Content-Type: application/json" -d "$body")
  echo "$resp" | python3 -m json.tool 2>/dev/null || echo "$resp"
  pid=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('pendingId') or d.get('data',{}).get('pendingId') or '')" 2>/dev/null || true)
  if [[ -n "$pid" ]]; then
    echo ""
    echo "Save this to your env file as PENDING_ID=$pid"
  fi
}

step_email_send() {
  load_env
  : "${PENDING_ID:?Set PENDING_ID from init step}"
  curl -sS -X POST "$BASE/register/verify/email/send" \
    -H "Content-Type: application/json" \
    -d "{\"pendingId\": \"$PENDING_ID\"}" | python3 -m json.tool
}

step_email_confirm() {
  load_env
  : "${PENDING_ID:?Set PENDING_ID}"
  read -r -p "Enter 6-digit email OTP: " otp
  curl -sS -X POST "$BASE/register/verify/email/confirm" \
    -H "Content-Type: application/json" \
    -d "{\"pendingId\": \"$PENDING_ID\", \"otp\": \"$otp\"}" | python3 -m json.tool
}

step_complete() {
  load_env
  : "${PENDING_ID:?Set PENDING_ID}"
  echo "POST $BASE/register/complete ..."
  resp=$(curl -sS -X POST "$BASE/register/complete" -H "Content-Type: application/json" -d "{\"pendingId\": \"$PENDING_ID\"}")
  echo "$resp" | python3 -m json.tool 2>/dev/null || echo "$resp"
  echo ""
  echo "If you see apiKey, copy it to a password manager NOW (shown once)."
}

case "${1:-}" in
  init) step_init ;;
  email-send) step_email_send ;;
  email-confirm) step_email_confirm ;;
  complete) step_complete ;;
  *)
    echo "Usage: $0 init | email-send | email-confirm | complete"
    echo "Configure scripts/synthesis-register.local.env first (see .example)."
    exit 1
    ;;
esac
