#!/usr/bin/env bash
# Read-only: compare game proxy rewardSystem() vs user registry rewardSystemAddress().
#
# Required in contract/.env:
#   RPC_URL, TYCOON_PROXY_ADDRESS, TYCOON_USER_REGISTRY_ADDRESS
#
# Optional:
#   TYCOON_EXPECTED_REWARD_SYSTEM=0x...  (logs whether both match this address)
#
# Usage: ./run-check-reward-system-alignment.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

: "${RPC_URL:?Set RPC_URL in contract/.env}"
: "${TYCOON_PROXY_ADDRESS:?Set TYCOON_PROXY_ADDRESS in contract/.env}"
: "${TYCOON_USER_REGISTRY_ADDRESS:?Set TYCOON_USER_REGISTRY_ADDRESS in contract/.env}"

forge script script/CheckRewardSystemAlignment.s.sol:CheckRewardSystemAlignmentScript \
  --rpc-url "$RPC_URL" \
  -vv
