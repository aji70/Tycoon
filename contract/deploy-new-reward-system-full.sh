#!/usr/bin/env bash
# Deploy, Verify, and Configure the new TycoonRewardSystem
# This script will deploy the reward system, verify it on Celoscan, and configure the proxy.

set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
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
: "${ETHERSCAN_API_KEY:?Set ETHERSCAN_API_KEY in .env}"

echo "Deploying, Verifying, and Configuring NEW TycoonRewardSystem..."
echo "RPC_URL: $RPC_URL"
echo "TYCOON_OWNER: $TYCOON_OWNER"
echo "GAME_CONTROLLER: $GAME_CONTROLLER"
echo "TYCOON_PROXY_ADDRESS: $TYCOON_PROXY_ADDRESS"
echo "------------------------------------------------------------"

forge script script/DeployAndConfigureRewardSystem.s.sol:DeployAndConfigureRewardSystemScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --verify \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --private-key "$PRIVATE_KEY"

echo "------------------------------------------------------------"
echo "Done! The new TycoonRewardSystem has been deployed, verified, and attached to the proxy."
