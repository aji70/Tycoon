#!/usr/bin/env bash
# Add an existing TycoonUserRegistry to the game proxy (set proxy's userRegistry to the given registry).
# Use this when you already deployed a registry and only need to point the game at it.
#
# Required in contract/.env:
#   RPC_URL, PRIVATE_KEY (owner of the proxy)
#   TYCOON_PROXY_ADDRESS, TYCOON_USER_REGISTRY_ADDRESS
#
# Usage: ./run-set-user-registry-on-game.sh
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
: "${TYCOON_PROXY_ADDRESS:?Set TYCOON_PROXY_ADDRESS in contract/.env}"
: "${TYCOON_USER_REGISTRY_ADDRESS:?Set TYCOON_USER_REGISTRY_ADDRESS in contract/.env (the registry to add)}"

echo "Setting game proxy userRegistry to $TYCOON_USER_REGISTRY_ADDRESS..."
forge script script/SetUserRegistry.s.sol:SetUserRegistryScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY"

echo "Done. Game proxy now uses registry at $TYCOON_USER_REGISTRY_ADDRESS"
