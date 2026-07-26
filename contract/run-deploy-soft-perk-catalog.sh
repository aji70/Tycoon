#!/usr/bin/env bash
# Deploy TycoonSoftPerkCatalog on Celo. Does NOT redeploy RewardSystem.
# Funds from buyPerk() transfer directly to TYCOON_REWARD_SYSTEM (treasury).
#
# Required env (contract/.env or export):
#   PRIVATE_KEY or --account
#   TYC_ADDRESS, USDC_ADDRESS, TYCOON_REWARD_SYSTEM, TYCOON_OWNER
# Optional: CUSDC_ADDRESS, USDT_ADDRESS, GAME_CONTROLLER, SEED_TIP_PACK, TIP_PACK_USDC_UNITS
set -euo pipefail
cd "$(dirname "$0")"
RPC="${CELO_RPC_URL:-https://forno.celo.org}"
forge script script/DeploySoftPerkCatalog.s.sol:DeploySoftPerkCatalogScript \
  --rpc-url "$RPC" \
  --broadcast \
  -vvvv
echo "Set SOFT_PERK_CATALOG_ADDRESS from the script log into backend/.env"
