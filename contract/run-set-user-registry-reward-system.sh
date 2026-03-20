#!/usr/bin/env bash
# Call TycoonUserRegistry.setRewardSystem so new/recreate smart wallets match the game perk contract.
#
# Required in contract/.env:
#   RPC_URL, PRIVATE_KEY (must own the user registry)
#   TYCOON_USER_REGISTRY_ADDRESS
#
# Reward address:
#   - Recommended: set TYCOON_PROXY_ADDRESS - script copies proxy.rewardSystem() (same as app/backend).
#   - Legacy / edge case: TYCOON_REGISTRY_REWARD_USE_ENV_ONLY=1 and TYCOON_REWARD_SYSTEM=0x...
#     (otherwise TYCOON_REWARD_SYSTEM is ignored when TYCOON_PROXY_ADDRESS is set)
#
# Usage:
#   ./run-set-user-registry-reward-system.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

: "${RPC_URL:?Set RPC_URL in contract/.env}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY in contract/.env (registry owner)}"
: "${TYCOON_USER_REGISTRY_ADDRESS:?Set TYCOON_USER_REGISTRY_ADDRESS in contract/.env}"

if [ -z "${TYCOON_REWARD_SYSTEM:-}" ]; then
  : "${TYCOON_PROXY_ADDRESS:?Set TYCOON_PROXY_ADDRESS in contract/.env, or set TYCOON_REWARD_SYSTEM}"
fi

echo "Setting user registry reward system..."
forge script script/SetUserRegistryRewardSystem.s.sol:SetUserRegistryRewardSystemScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY"

echo "Done."
