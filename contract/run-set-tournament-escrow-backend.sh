#!/usr/bin/env bash
# Call TycoonTournamentEscrow.setBackend so the backend can createTournament / registerForTournamentFor.
#
# The transaction is signed with PRIVATE_KEY (must be the escrow contract **owner**).
# The new backend address defaults to the wallet derived from BACKEND_GAME_CONTROLLER_PRIVATE_KEY
# (same as Tycoon setBackendGameController / backend .env).
#
# Required in contract/.env (or export before running):
#   RPC_URL
#   PRIVATE_KEY              — escrow owner (can deploy key / TYCOON_OWNER)
#   TOURNAMENT_ESCROW_ADDRESS — deployed TycoonTournamentEscrow
#   BACKEND_GAME_CONTROLLER_PRIVATE_KEY — used only to compute default BACKEND_ADDRESS
#
# Optional:
#   BACKEND_ADDRESS          — if set, skips deriving from BACKEND_GAME_CONTROLLER_PRIVATE_KEY
#
# Usage:
#   cd contract && ./run-set-tournament-escrow-backend.sh
#   DRY_RUN=1 ./run-set-tournament-escrow-backend.sh   # print addresses, no tx
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${RPC_URL:?Set RPC_URL in contract/.env}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY (escrow owner) in contract/.env}"
: "${TOURNAMENT_ESCROW_ADDRESS:?Set TOURNAMENT_ESCROW_ADDRESS in contract/.env}"

if [ -n "${BACKEND_ADDRESS:-}" ]; then
  export BACKEND_ADDRESS
elif [ -n "${BACKEND_GAME_CONTROLLER_PRIVATE_KEY:-}" ]; then
  BACKEND_ADDRESS="$(cast wallet address --private-key "$BACKEND_GAME_CONTROLLER_PRIVATE_KEY")"
  export BACKEND_ADDRESS
else
  echo "Set BACKEND_ADDRESS or BACKEND_GAME_CONTROLLER_PRIVATE_KEY in .env" >&2
  exit 1
fi

echo "RPC:                      $RPC_URL"
echo "Tournament escrow:        $TOURNAMENT_ESCROW_ADDRESS"
echo "Signer (escrow owner):    $(cast wallet address --private-key "$PRIVATE_KEY")"
echo "New backend (setBackend): $BACKEND_ADDRESS"

if [ "${DRY_RUN:-}" = "1" ]; then
  echo "DRY_RUN=1 — not broadcasting."
  exit 0
fi

forge script script/SetTournamentEscrowBackend.s.sol:SetTournamentEscrowBackendScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY"

echo "Done. Backend wallet can now call createTournament on the escrow."
