#!/usr/bin/env bash
# Celo only: call TycoonTournamentEscrow.setBackend so the backend can createTournament.
#
# Signs with PRIVATE_KEY (escrow contract owner). Backend address defaults from
# BACKEND_GAME_CONTROLLER_PRIVATE_KEY (same wallet as Tycoon setBackendGameController).
#
# Escrow address is resolved from (first match):
#   TOURNAMENT_ESCROW_ADDRESS, TOURNAMENT_ESCROW_ADDRESS_CELO, TOURNAMENT_ESCROW_CELO,
#   NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW, NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW_ADDRESS
#
# Loads: contract/.env → ../backend/.env → parses ../frontend/.env and .env.local for NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW*
# RPC: RPC_URL or CELO_RPC_URL
#
# Usage:
#   cd contract && ./run-set-tournament-escrow-backend.sh
#   DRY_RUN=1 ./run-set-tournament-escrow-backend.sh
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

BACKEND_ENV="$SCRIPT_DIR/../backend/.env"

_SAVED_PRIVATE_KEY="${PRIVATE_KEY-}"
_SAVED_RPC_URL="${RPC_URL-}"

if [ -f "$BACKEND_ENV" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$BACKEND_ENV"
  set +a
  if [ -n "$_SAVED_PRIVATE_KEY" ]; then PRIVATE_KEY="$_SAVED_PRIVATE_KEY"; export PRIVATE_KEY; fi
  if [ -n "$_SAVED_RPC_URL" ]; then RPC_URL="$_SAVED_RPC_URL"; export RPC_URL; fi
fi

# Frontend often has the Celo escrow (NEXT_PUBLIC_*); do not full-source (avoids breaking bash on complex .env).
# Same order as Next.js: base .env then .env.local overrides.
load_frontend_celo_escrow() {
  local ff
  for ff in "$SCRIPT_DIR/../frontend/.env" "$SCRIPT_DIR/../frontend/.env.local"; do
    [ -f "$ff" ] || continue
    while IFS= read -r line || [ -n "$line" ]; do
      line="${line%%#*}"
      line="${line#"${line%%[![:space:]]*}"}"
      [[ -z "$line" ]] && continue
      case "$line" in
        NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW=*|NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW_ADDRESS=*)
          key="${line%%=*}"
          val="${line#*=}"
          val="${val%"${val##*[![:space:]]}"}"
          val="${val#"${val%%[![:space:]]*}"}"
          val="${val%\"}"; val="${val#\"}"
          val="${val%\'}"; val="${val#\'}"
          export "${key}=${val}"
          ;;
      esac
    done < "$ff"
  done
}

load_frontend_celo_escrow

if [ -z "${RPC_URL:-}" ] && [ -n "${CELO_RPC_URL:-}" ]; then
  RPC_URL="$CELO_RPC_URL"
  export RPC_URL
fi

resolve_escrow_address_celo() {
  if [ -n "${TOURNAMENT_ESCROW_ADDRESS:-}" ]; then
    printf '%s' "$TOURNAMENT_ESCROW_ADDRESS"
    return
  fi
  local n val
  for n in TOURNAMENT_ESCROW_ADDRESS_CELO TOURNAMENT_ESCROW_CELO \
    NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW_ADDRESS; do
    val="${!n:-}"
    if [ -n "$val" ]; then
      printf '%s' "$val"
      return
    fi
  done
}

TOURNAMENT_ESCROW_ADDRESS="$(resolve_escrow_address_celo)"
export TOURNAMENT_ESCROW_ADDRESS

: "${RPC_URL:?Set RPC_URL or CELO_RPC_URL (e.g. in contract/.env or backend/.env)}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY — escrow owner / TYCOON_OWNER (contract/.env)}"

if [ -z "$TOURNAMENT_ESCROW_ADDRESS" ]; then
  echo "Missing Celo tournament escrow address. Set one of in backend/.env, contract/.env, or frontend/.env:" >&2
  echo "  TOURNAMENT_ESCROW_ADDRESS_CELO or TOURNAMENT_ESCROW_CELO" >&2
  echo "  TOURNAMENT_ESCROW_ADDRESS" >&2
  echo "  NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW or NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW_ADDRESS" >&2
  exit 1
fi

if [ -n "${BACKEND_ADDRESS:-}" ]; then
  export BACKEND_ADDRESS
elif [ -n "${BACKEND_GAME_CONTROLLER_PRIVATE_KEY:-}" ]; then
  BACKEND_ADDRESS="$(cast wallet address --private-key "$BACKEND_GAME_CONTROLLER_PRIVATE_KEY")"
  export BACKEND_ADDRESS
else
  echo "Set BACKEND_ADDRESS or BACKEND_GAME_CONTROLLER_PRIVATE_KEY (e.g. in backend/.env)" >&2
  exit 1
fi

echo "Chain: Celo"
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

echo "Done. Backend wallet can now call createTournament on the Celo escrow."
