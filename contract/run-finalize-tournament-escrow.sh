#!/usr/bin/env bash
# Call TycoonTournamentEscrow.lockTournament (if Open) + finalizeTournament on Celo.
# Signer must be escrow backend or owner (same as backend escrow signer).
#
# Loads: contract/.env, backend/.env, frontend NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW* (same as run-set-tournament-escrow-backend.sh)
#
# Required env:
#   TOURNAMENT_ID
#   FINALIZE_RECIPIENT_0, FINALIZE_AMOUNT_WEI_0
# Optional:
#   FINALIZE_RECIPIENT_COUNT (default 1) and _1/_2... for splits
#   RPC_URL or CELO_RPC_URL
#
# Signer (first set wins):
#   FINALIZE_PRIVATE_KEY, BACKEND_GAME_CONTROLLER_PRIVATE_KEY, TOURNAMENT_ESCROW_SIGNER_PRIVATE_KEY, PRIVATE_KEY
#
# Example — one winner, 95% of 0.2 USDC pool = 0.19 USDC = 190000 wei (6 decimals):
#   TOURNAMENT_ID=42 \
#   FINALIZE_RECIPIENT_0=0xYourWinnerSmartWallet \
#   FINALIZE_AMOUNT_WEI_0=190000 \
#   ./run-finalize-tournament-escrow.sh
#
# DRY_RUN=1 — print resolved env and exit without broadcasting.
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
  if [ -n "${_SAVED_PRIVATE_KEY:-}" ]; then PRIVATE_KEY="$_SAVED_PRIVATE_KEY"; export PRIVATE_KEY; fi
  if [ -n "${_SAVED_RPC_URL:-}" ]; then RPC_URL="$_SAVED_RPC_URL"; export RPC_URL; fi
fi

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
  local n val
  for n in TOURNAMENT_ESCROW_ADDRESS_CELO TOURNAMENT_ESCROW_CELO \
    NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW_ADDRESS \
    TYCOON_TOURNAMENT_ESCROW_ADDRESS TOURNAMENT_ESCROW_ADDRESS; do
    val="${!n:-}"
    if [ -n "$val" ]; then
      printf '%s' "$val"
      return
    fi
  done
}

TOURNAMENT_ESCROW_ADDRESS="$(resolve_escrow_address_celo)"
export TOURNAMENT_ESCROW_ADDRESS

: "${RPC_URL:?Set RPC_URL or CELO_RPC_URL}"
: "${TOURNAMENT_ESCROW_ADDRESS:?Set Celo tournament escrow address (see run-set-tournament-escrow-backend.sh)}"
: "${TOURNAMENT_ID:?Set TOURNAMENT_ID (e.g. 42)}"
export TOURNAMENT_ID

FINALIZE_PRIVATE_KEY="${FINALIZE_PRIVATE_KEY:-${BACKEND_GAME_CONTROLLER_PRIVATE_KEY:-${TOURNAMENT_ESCROW_SIGNER_PRIVATE_KEY:-${PRIVATE_KEY:-}}}}"
if [ -z "$FINALIZE_PRIVATE_KEY" ]; then
  echo "Set one of: FINALIZE_PRIVATE_KEY, BACKEND_GAME_CONTROLLER_PRIVATE_KEY, TOURNAMENT_ESCROW_SIGNER_PRIVATE_KEY, PRIVATE_KEY" >&2
  exit 1
fi

: "${FINALIZE_RECIPIENT_0:?Set FINALIZE_RECIPIENT_0 (winner smart wallet 0x...)}"
: "${FINALIZE_AMOUNT_WEI_0:?Set FINALIZE_AMOUNT_WEI_0 (USDC 6-decimal wei, e.g. 190000)}"

export FINALIZE_RECIPIENT_COUNT="${FINALIZE_RECIPIENT_COUNT:-1}"

echo "Chain: Celo"
echo "RPC:               $RPC_URL"
echo "Escrow:            $TOURNAMENT_ESCROW_ADDRESS"
echo "Tournament id:     $TOURNAMENT_ID"
echo "Recipient count:   $FINALIZE_RECIPIENT_COUNT"
echo "Signer:            $(cast wallet address --private-key "$FINALIZE_PRIVATE_KEY")"

if [ "${DRY_RUN:-}" = "1" ]; then
  echo "DRY_RUN=1 — not broadcasting."
  exit 0
fi

forge script script/FinalizeTournamentEscrow.s.sol:FinalizeTournamentEscrowScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$FINALIZE_PRIVATE_KEY"

echo "Done."
