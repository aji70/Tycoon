#!/usr/bin/env bash
# Deploy and configure new TycoonUserRegistry using contract/.env
# Usage: ./run-deploy-user-registry.sh [--verify]
set -e
cd "$(dirname "$0")"

# Load .env into environment (no export needed in .env)
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Required for broadcast
: "${RPC_URL:?Set RPC_URL in .env}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"

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
