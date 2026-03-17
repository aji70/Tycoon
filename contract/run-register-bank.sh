#!/usr/bin/env bash
# Register the Bank address (0xFb0331d4F586D38Df611E34b9bC77a99F96f09ee) as username "Bank" on the Tycoon contract.
# Required so setPropertyStats("Bank", buyerUsername) succeeds when a user buys a property from the bank in-game.
#
# Requires contract/.env: RPC_URL, PRIVATE_KEY (owner or backend game controller), TYCOON_PROXY_ADDRESS
# Optional: BANK_ADDRESS (defaults to 0xFb0331d4F586D38Df611E34b9bC77a99F96f09ee)

set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

: "${RPC_URL:?Set RPC_URL in .env}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY in .env}"
: "${TYCOON_PROXY_ADDRESS:?Set TYCOON_PROXY_ADDRESS in .env}"

BANK_ADDRESS="${BANK_ADDRESS:-0xFb0331d4F586D38Df611E34b9bC77a99F96f09ee}"

echo "Registering Bank on Tycoon proxy"
echo "  TYCOON_PROXY_ADDRESS=$TYCOON_PROXY_ADDRESS"
echo "  BANK_ADDRESS=$BANK_ADDRESS"
echo "  RPC_URL=$RPC_URL"
echo ""

forge script script/RegisterBank.s.sol:RegisterBankScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY"

echo ""
echo "Done. Username 'Bank' is now registered for $BANK_ADDRESS."
