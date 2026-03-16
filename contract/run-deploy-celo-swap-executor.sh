#!/usr/bin/env bash
# Deploy CeloSwapExecutor using contract/.env (RPC_URL, PRIVATE_KEY, USDC_ADDRESS).
# Usage: ./run-deploy-celo-swap-executor.sh [--verify]
set -e
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

: "${RPC_URL:?Set RPC_URL in .env}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"

EXTRA=
[[ "${1:-}" == "--verify" ]] && EXTRA="--verify"

echo "Using RPC_URL=$RPC_URL"
echo "USDC_ADDRESS=${USDC_ADDRESS:-}(from .env or script default)"
echo "Broadcasting with PRIVATE_KEY..."
echo ""

forge script script/DeployCeloSwapExecutor.s.sol:DeployCeloSwapExecutorScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  $EXTRA \
  --private-key "$PRIVATE_KEY"

echo ""
echo "Done. Set frontend NEXT_PUBLIC_CELO_SWAP_EXECUTOR_ADDRESS to the CeloSwapExecutor address above."
