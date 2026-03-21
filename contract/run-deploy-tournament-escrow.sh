#!/usr/bin/env bash
# Deploy TycoonTournamentEscrow, optionally verify on Celoscan, optionally append addresses to contract/.env.
# Tournament escrow is separate from TycoonUpgradeable (UUPS proxy) but uses the same env file for ops.
#
# Required in contract/.env:
#   RPC_URL, PRIVATE_KEY, TYCOON_OWNER, USDC_ADDRESS
# Optional:
#   CHAIN_ID (default 42220 Celo mainnet)
#   ETHERSCAN_API_KEY — required for --verify
#
# Usage:
#   ./run-deploy-tournament-escrow.sh
#   ./run-deploy-tournament-escrow.sh --verify
#   ./run-deploy-tournament-escrow.sh --verify --write-env
#
# After deploy:
#   1. Call setBackend with your backend game-controller wallet:
#        ./run-set-tournament-escrow-backend.sh
#   2. Set frontend NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW (and backend TOURNAMENT_ESCROW_ADDRESS_CELO if not using --write-env).

set -euo pipefail
cd "$(dirname "$0")"

VERIFY=0
WRITE_ENV=0
for arg in "$@"; do
  case "$arg" in
    --verify) VERIFY=1 ;;
    --write-env) WRITE_ENV=1 ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: $0 [--verify] [--write-env]" >&2
      exit 1
      ;;
  esac
done

if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

: "${RPC_URL:?Set RPC_URL in contract/.env}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY in contract/.env}"
: "${TYCOON_OWNER:?Set TYCOON_OWNER in contract/.env}"
: "${USDC_ADDRESS:?Set USDC_ADDRESS in contract/.env}"

CHAIN_ID="${CHAIN_ID:-42220}"

EXTRA=()
if [ "$VERIFY" -eq 1 ]; then
  : "${ETHERSCAN_API_KEY:?Set ETHERSCAN_API_KEY in contract/.env for --verify}"
  EXTRA=(--verify --etherscan-api-key "$ETHERSCAN_API_KEY")
fi

echo "Deploy TycoonTournamentEscrow"
echo "CHAIN_ID=$CHAIN_ID RPC_URL=$RPC_URL"
echo "TYCOON_OWNER=$TYCOON_OWNER USDC_ADDRESS=$USDC_ADDRESS"
echo ""

forge script script/DeployTournamentEscrow.s.sol:DeployTournamentEscrowScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY" \
  "${EXTRA[@]}"

BROADCAST="broadcast/DeployTournamentEscrow.s.sol/${CHAIN_ID}/run-latest.json"
if [ ! -f "$BROADCAST" ]; then
  echo "No broadcast file at $BROADCAST — copy the escrow address from forge output above." >&2
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Install jq to parse the deployed address from $BROADCAST (or read TycoonTournamentEscrow: 0x... from forge output)." >&2
  exit 1
fi

ESCROW_ADDR="$(jq -r '.transactions[]? | select(.contractName == "TycoonTournamentEscrow") | .contractAddress' "$BROADCAST" | head -1)"
if [ -z "$ESCROW_ADDR" ] || [ "$ESCROW_ADDR" = "null" ]; then
  echo "Could not read TycoonTournamentEscrow address from $BROADCAST" >&2
  exit 1
fi

echo ""
echo "Deployed TycoonTournamentEscrow: $ESCROW_ADDR"
echo ""

if [ "$WRITE_ENV" -eq 1 ]; then
  ENV_FILE=".env"
  STAMP="$(date -u +%Y-%m-%dT%H:%MZ)"
  {
    echo ""
    echo "# --- Tournament escrow ($STAMP) deploy-run-deploy-tournament-escrow.sh ---"
    echo "TYCOON_TOURNAMENT_ESCROW_ADDRESS=$ESCROW_ADDR"
    echo "TOURNAMENT_ESCROW_ADDRESS_CELO=$ESCROW_ADDR"
    echo "TOURNAMENT_ESCROW_ADDRESS=$ESCROW_ADDR"
  } >> "$ENV_FILE"
  echo "Appended TYCOON_TOURNAMENT_ESCROW_ADDRESS, TOURNAMENT_ESCROW_ADDRESS_CELO, TOURNAMENT_ESCROW_ADDRESS to $ENV_FILE"
  echo "Tip: remove older duplicate tournament lines above so set-backend and verify use one address."
fi

echo "Add to frontend .env (Celo):"
echo "  NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW=$ESCROW_ADDR"
echo ""
echo "Verification (if you did not use --verify): set TYCOON_TOURNAMENT_ESCROW_ADDRESS=$ESCROW_ADDR in .env and run:"
echo "  ./script/VerifyTycoon.sh   # verifies escrow when that var + USDC_ADDRESS + TYCOON_OWNER are set"
echo ""
echo "Wire backend signer on escrow:"
echo "  ./run-set-tournament-escrow-backend.sh"
