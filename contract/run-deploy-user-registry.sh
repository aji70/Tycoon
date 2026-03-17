#!/usr/bin/env bash
# Deploy and configure new TycoonUserRegistry (wallet-first signup, createWalletForUserByBackend, linkEOAToProfile, setRewardSystem).
# Usage: ./run-deploy-user-registry.sh [--verify]
#
# Required in .env: RPC_URL, PRIVATE_KEY, TYCOON_OWNER, TYCOON_PROXY_ADDRESS, TYCOON_REWARDS_FAUCET_ADDRESS,
#                   OPERATOR_ADDRESS, WITHDRAWAL_AUTHORITY_ADDRESS
# Optional: TYCOON_NAIRA_VAULT_ADDRESS, TYCOON_REWARD_SYSTEM, DEFAULT_DAILY_CAP_USD6, DEFAULT_PRICE_CELO_USD6
# See contract/.env.example.
set -e
cd "$(dirname "$0")"

# Load .env into environment (Forge scripts read vm.env* from here)
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Required for broadcast
: "${RPC_URL:?Set RPC_URL in .env}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"
: "${OPERATOR_ADDRESS:?Set OPERATOR_ADDRESS in .env (backend operator for smart wallets)}"
: "${WITHDRAWAL_AUTHORITY_ADDRESS:?Set WITHDRAWAL_AUTHORITY_ADDRESS in .env (signs withdrawals after PIN)}"

EXTRA=
[[ "${1:-}" == "--verify" ]] && EXTRA="--verify"

echo "Using RPC_URL=$RPC_URL"
echo "Broadcasting with PRIVATE_KEY (address: ${TYCOON_OWNER:-?})..."
echo ""

forge script script/DeployAndConfigureUserRegistry.s.sol:DeployAndConfigureUserRegistryScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  $EXTRA \
  --private-key "$PRIVATE_KEY"

echo ""
echo "Done. Update backend TYCOON_USER_REGISTRY_CELO and frontend NEXT_PUBLIC_CELO_USER_REGISTRY with the new registry address above."
