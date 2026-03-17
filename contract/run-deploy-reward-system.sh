#!/usr/bin/env bash
# Deploy a NEW TycoonRewardSystem (dual minter: faucet + game proxy).
# Requires contract/.env: RPC_URL, PRIVATE_KEY, TYC_ADDRESS, USDC_ADDRESS, TYCOON_OWNER,
#                        TYCOON_REWARDS_FAUCET_ADDRESS, TYCOON_PROXY_ADDRESS
#
# After deploy, update:
# - contract/.env: NEW_TYCOON_REWARD_SYSTEM=<printed address>
# - frontend `REWARD_CONTRACT_ADDRESSES` / backend config to point to the new contract
#
# Optional: pass --verify to include Foundry verification flags.

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
: "${TYCOON_REWARDS_FAUCET_ADDRESS:?Set TYCOON_REWARDS_FAUCET_ADDRESS in .env}"
: "${TYCOON_PROXY_ADDRESS:?Set TYCOON_PROXY_ADDRESS in .env}"

EXTRA=
[[ "${1:-}" == "--verify" ]] && EXTRA="--verify"

echo "Deploying NEW TycoonRewardSystem (dual minter)"
echo "RPC_URL=$RPC_URL"
echo "TYC_ADDRESS=$TYC_ADDRESS"
echo "USDC_ADDRESS=$USDC_ADDRESS"
echo "TYCOON_OWNER=$TYCOON_OWNER"
echo "TYCOON_REWARDS_FAUCET_ADDRESS=$TYCOON_REWARDS_FAUCET_ADDRESS"
echo "TYCOON_PROXY_ADDRESS=$TYCOON_PROXY_ADDRESS"
echo ""

forge script script/DeployNewRewardSystemWithDualMinter.s.sol:DeployNewRewardSystemWithDualMinterScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  $EXTRA \
  --private-key "$PRIVATE_KEY"

echo ""
echo "Done. Copy the printed address into contract/.env as NEW_TYCOON_REWARD_SYSTEM=0x..."
