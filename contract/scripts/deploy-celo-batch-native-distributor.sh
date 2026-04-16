#!/usr/bin/env bash
# Deploy CeloBatchNativeDistributor on Celo and verify on CeloScan.
#
# Prerequisites (in contract/.env or exported in the shell):
#   RPC_URL          — Celo HTTPS RPC (e.g. https://forno.celo.org)
#   PRIVATE_KEY      — deployer key (with CELO for gas); with or without 0x
#   ETHERSCAN_API_KEY — API key from https://celoscan.io/myapikey (or CELOSCAN_API_KEY)
#
# Usage:
#   cd contract && ./scripts/deploy-celo-batch-native-distributor.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${RPC_URL:?Set RPC_URL (Celo RPC) in contract/.env or environment}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY in contract/.env or environment}"

# CeloScan key: Foundry reads ETHERSCAN_API_KEY from foundry.toml [etherscan].celo
if [[ -z "${ETHERSCAN_API_KEY:-}" && -n "${CELOSCAN_API_KEY:-}" ]]; then
  export ETHERSCAN_API_KEY="$CELOSCAN_API_KEY"
fi
: "${ETHERSCAN_API_KEY:?Set ETHERSCAN_API_KEY or CELOSCAN_API_KEY for verification (get one at https://celoscan.io/myapikey)}"

PK="$PRIVATE_KEY"
if [[ "$PK" != 0x* ]]; then
  PK="0x$PK"
fi

echo "Deploying CeloBatchNativeDistributor via forge script (broadcast + verify)..."
forge script script/DeployCeloBatchNativeDistributor.s.sol:DeployCeloBatchNativeDistributor \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --verify \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --private-key "$PK" \
  -vvvv

echo ""
echo "Done. Set on the backend:"
echo "  CELO_BATCH_NATIVE_DISTRIBUTOR_ADDRESS=<address printed above>"
