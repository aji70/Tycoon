#!/usr/bin/env bash
# Deploy new TycoonGameFaucet (recordPropertySaleByAgent) and point TYCOON_PROXY at it.
# Does NOT upgrade the UUPS game implementation unless UPGRADE_TYCOON_IMPL=1.
#
# Required in contract/.env:
#   RPC_URL, PRIVATE_KEY (TYCOON_OWNER), TYCOON_PROXY_ADDRESS, TYCOON_OWNER
#
# Optional:
#   TYCOON_GAME_FAUCET_ADDRESS — old faucet (default: proxy.gameFaucet())
#   GAME_CONTROLLER — backend game controller (default: copied from old faucet)
#   AGENT_WRITER_1 .. AGENT_WRITER_8 — agent EOAs to authorize (or set below from AI_PLAYER_* keys)
#   UPGRADE_TYCOON_IMPL=1 — also run UpgradeTycoonImpl.s.sol (only if you changed TycoonUpgradeable.sol)
#   VERIFY=1 — pass --verify to forge (needs ETHERSCAN_API_KEY)
#
# Usage:
#   ./run-upgrade-game-faucet.sh
#   ./run-upgrade-game-faucet.sh --write-env   # append TYCOON_GAME_FAUCET_ADDRESS to contract/.env
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# shellcheck source=lib/load-env.sh
source "$SCRIPT_DIR/lib/load-env.sh"
load_env_file "$SCRIPT_DIR/.env"

# Optional: load AI_PLAYER keys from repo backend/.env and derive writer addresses
BACKEND_ENV="$SCRIPT_DIR/../backend/.env"
load_env_file "$BACKEND_ENV"

if command -v cast >/dev/null 2>&1; then
  for i in 1 2 3 4 5 6 7 8; do
    pk_var="AI_PLAYER_${i}_PRIVATE_KEY"
    pk="${!pk_var:-}"
    writer_var="AGENT_WRITER_$i"
    if [ -n "$pk" ] && [ -z "${!writer_var:-}" ]; then
      addr=$(cast wallet address --private-key "$pk" 2>/dev/null || true)
      if [ -n "$addr" ]; then
        export "AGENT_WRITER_$i=$addr"
        echo "AGENT_WRITER_$i=$addr (from AI_PLAYER_${i}_PRIVATE_KEY)"
      fi
    fi
  done
fi

: "${RPC_URL:?Set RPC_URL in contract/.env}"
: "${PRIVATE_KEY:?Set PRIVATE_KEY in contract/.env}"
: "${TYCOON_PROXY_ADDRESS:?Set TYCOON_PROXY_ADDRESS in contract/.env}"
: "${TYCOON_OWNER:?Set TYCOON_OWNER in contract/.env}"

VERIFY_ARGS=()
if [ "${VERIFY:-}" = "1" ]; then
  VERIFY_ARGS=(--verify)
fi

echo "=== 1/2 Deploy new TycoonGameFaucet + setGameFaucet on proxy ==="
forge script script/UpgradeGameFaucet.s.sol:UpgradeGameFaucetScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY" \
  "${VERIFY_ARGS[@]}"

if [ "${UPGRADE_TYCOON_IMPL:-}" = "1" ]; then
  echo "=== Optional: Upgrade TycoonUpgradeable UUPS implementation ==="
  forge script script/UpgradeTycoonImpl.s.sol:UpgradeTycoonImplScript \
    --rpc-url "$RPC_URL" \
    --broadcast \
    --private-key "$PRIVATE_KEY" \
    "${VERIFY_ARGS[@]}"
else
  echo "(Skipped UUPS impl upgrade — set UPGRADE_TYCOON_IMPL=1 only if TycoonUpgradeable.sol changed)"
fi

BROADCAST_JSON="broadcast/UpgradeGameFaucet.s.sol/42220/run-latest.json"
if [ -f "$BROADCAST_JSON" ] && command -v jq >/dev/null 2>&1; then
  NEW_FAUCET=$(jq -r '.transactions[] | select(.contractName=="TycoonGameFaucet") | .contractAddress' "$BROADCAST_JSON" | head -1)
  if [ -n "$NEW_FAUCET" ] && [ "$NEW_FAUCET" != "null" ]; then
    echo ""
    echo "New faucet address: $NEW_FAUCET"
    if [ "${1:-}" = "--write-env" ] || [ "${WRITE_ENV:-}" = "1" ]; then
      if grep -q '^TYCOON_GAME_FAUCET_ADDRESS=' .env 2>/dev/null; then
        sed -i "s|^TYCOON_GAME_FAUCET_ADDRESS=.*|TYCOON_GAME_FAUCET_ADDRESS=$NEW_FAUCET|" .env
      else
        echo "TYCOON_GAME_FAUCET_ADDRESS=$NEW_FAUCET" >> .env
      fi
      echo "Updated contract/.env TYCOON_GAME_FAUCET_ADDRESS"
      BACKEND_ENV_FILE="$SCRIPT_DIR/../backend/.env"
      if [ -f "$BACKEND_ENV_FILE" ]; then
        if grep -q '^TYCOON_GAME_FAUCET_ADDRESS=' "$BACKEND_ENV_FILE" 2>/dev/null; then
          sed -i "s|^TYCOON_GAME_FAUCET_ADDRESS=.*|TYCOON_GAME_FAUCET_ADDRESS=$NEW_FAUCET|" "$BACKEND_ENV_FILE"
        else
          echo "TYCOON_GAME_FAUCET_ADDRESS=$NEW_FAUCET" >> "$BACKEND_ENV_FILE"
        fi
        if ! grep -q '^ENABLE_AGENT_SIGNED_PROPERTY_SALE=' "$BACKEND_ENV_FILE" 2>/dev/null; then
          echo "ENABLE_AGENT_SIGNED_PROPERTY_SALE=true" >> "$BACKEND_ENV_FILE"
        fi
        echo "Updated backend/.env TYCOON_GAME_FAUCET_ADDRESS + ENABLE_AGENT_SIGNED_PROPERTY_SALE"
      fi
    fi
  fi
fi

echo ""
echo "Done. Next:"
echo "  1. Fund authorized agent wallets with CELO on Celo mainnet"
echo "  2. Restart backend with ENABLE_AGENT_SIGNED_PROPERTY_SALE=true"
echo "  3. Run an ONCHAIN_AGENT_VS_* match with ENABLE_AGENT_GAME_RUNNER=true"
