#!/usr/bin/env bash
# Deploy TycoonNairaVault only. Use when your USDC is 0xcebA... (Celo) and the existing vault uses 0x765...
# Set in contract/.env: TYCOON_OWNER, PRIVATE_KEY, RPC_URL, USDC_ADDRESS (e.g. 0xcebA9300f2b948710d2653dD7B07f33A8B32118C).
# After deploy: set NEXT_PUBLIC_CELO_NAIRA_VAULT to the new vault address; update user registry nairaVault if needed.
set -e
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

: "${RPC_URL:?Set RPC_URL in .env}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"
: "${TYCOON_OWNER:?Set TYCOON_OWNER in .env}"
: "${USDC_ADDRESS:?Set USDC_ADDRESS in .env (e.g. 0xcebA9300f2b948710d2653dD7B07f33A8B32118C for Celo USDC)}"

EXTRA=
[[ "${1:-}" == "--verify" ]] && EXTRA="--verify"

echo "Deploying TycoonNairaVault with USDC=$USDC_ADDRESS"
echo "RPC_URL=$RPC_URL"
echo "Broadcasting..."
echo ""

forge script script/DeployNairaVault.s.sol:DeployNairaVaultScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  $EXTRA \
  --private-key "$PRIVATE_KEY"

echo ""
echo "Done. Set NEXT_PUBLIC_CELO_NAIRA_VAULT to the TycoonNairaVault address above (frontend .env)."
echo "If you use a user registry, call setNairaVault(newVaultAddress) on it so wallets use this vault."
