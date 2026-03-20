#!/usr/bin/env bash
# Deploy TycoonRewardSystem and wire it to the game proxy (+ optional user registry).
# Uses: script/DeployAndConfigureRewardSystem.s.sol
#
# Required in contract/.env:
#   RPC_URL, PRIVATE_KEY, TYC_ADDRESS, USDC_ADDRESS, TYCOON_OWNER,
#   TYCOON_PROXY_ADDRESS, GAME_CONTROLLER
# Optional:
#   TYCOON_USER_REGISTRY_ADDRESS
#
# Usage:
#   ./run-deploy-reward-system.sh
#   ./run-deploy-reward-system.sh --verify   # needs ETHERSCAN_API_KEY in .env

set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

: "${RPC_URL:?Set RPC_URL in .env}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"
: "${TYC_ADDRESS:?Set TYC_ADDRESS in .env}"
: "${USDC_ADDRESS:?Set USDC_ADDRESS in .env}"
: "${TYCOON_OWNER:?Set TYCOON_OWNER in .env}"
: "${TYCOON_PROXY_ADDRESS:?Set TYCOON_PROXY_ADDRESS in .env}"
: "${GAME_CONTROLLER:?Set GAME_CONTROLLER in .env}"

EXTRA=()
if [[ "${1:-}" == "--verify" ]]; then
  : "${ETHERSCAN_API_KEY:?Set ETHERSCAN_API_KEY in .env for --verify}"
  EXTRA=(--verify --etherscan-api-key "$ETHERSCAN_API_KEY")
fi

echo "Deploy + configure TycoonRewardSystem"
echo "RPC_URL=$RPC_URL"
echo "TYCOON_PROXY_ADDRESS=$TYCOON_PROXY_ADDRESS"
echo "GAME_CONTROLLER=$GAME_CONTROLLER"
echo ""

forge script script/DeployAndConfigureRewardSystem.s.sol:DeployAndConfigureRewardSystemScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY" \
  "${EXTRA[@]}"

echo ""
echo "Done. Set TYCOON_REWARD_SYSTEM / NEW_TYCOON_REWARD_SYSTEM in .env to the printed address; update backend/frontend env if needed."
