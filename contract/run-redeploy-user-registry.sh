#!/usr/bin/env bash
# Redeploy TycoonUserRegistry (latest code, including recreateWalletForUserByBackend) and add it to the game proxy.
# Usage: ./run-redeploy-user-registry.sh [--verify]
#
# Required in contract/.env:
#   RPC_URL, PRIVATE_KEY, TYCOON_OWNER
#   TYCOON_PROXY_ADDRESS, TYCOON_REWARDS_FAUCET_ADDRESS
#   OPERATOR_ADDRESS, WITHDRAWAL_AUTHORITY_ADDRESS
# Optional: TYCOON_NAIRA_VAULT_ADDRESS, TYCOON_REWARD_SYSTEM, DEFAULT_DAILY_CAP_USD6, DEFAULT_PRICE_CELO_USD6
#
# After run: update backend TYCOON_USER_REGISTRY_CELO and frontend NEXT_PUBLIC_CELO_USER_REGISTRY with the printed address.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

: "${RPC_URL:?Set RPC_URL in contract/.env}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY in contract/.env}"
: "${TYCOON_OWNER:?Set TYCOON_OWNER in contract/.env (registry owner; must match PRIVATE_KEY)}"
: "${TYCOON_PROXY_ADDRESS:?Set TYCOON_PROXY_ADDRESS in contract/.env}"
: "${TYCOON_REWARDS_FAUCET_ADDRESS:?Set TYCOON_REWARDS_FAUCET_ADDRESS in contract/.env}"
: "${OPERATOR_ADDRESS:?Set OPERATOR_ADDRESS in contract/.env}"
: "${WITHDRAWAL_AUTHORITY_ADDRESS:?Set WITHDRAWAL_AUTHORITY_ADDRESS in contract/.env}"

EXTRA=""
[[ "${1:-}" == "--verify" ]] && EXTRA="--verify"

echo "Redeploying TycoonUserRegistry and adding to game..."
echo "RPC_URL=$RPC_URL"
echo "Proxy=$TYCOON_PROXY_ADDRESS"
echo ""

forge script script/DeployAndConfigureUserRegistry.s.sol:DeployAndConfigureUserRegistryScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  $EXTRA \
  --private-key "$PRIVATE_KEY"

echo ""
echo "---"
echo "Next: set the new TycoonUserRegistry address in your env:"
echo "  backend:  TYCOON_USER_REGISTRY_CELO=<TycoonUserRegistry address from log above>"
echo "  frontend: NEXT_PUBLIC_CELO_USER_REGISTRY=<same address>"
echo "  contract/.env: TYCOON_USER_REGISTRY_ADDRESS=<same address> (optional, for scripts)"
echo "Backend needs TYCOON_OWNER_PRIVATE_KEY (or REGISTRY_OWNER_PRIVATE_KEY) to call recreateWalletForUserByBackend."
