#!/usr/bin/env bash
# Verify all Tycoon core contracts on CeloScan (Celo Mainnet).
# Set in contract/.env: ETHERSCAN_API_KEY; then addresses from deploy logs:
#   TYC_ADDRESS, TYCOON_REWARD_SYSTEM, TYCOON_LOGIC_ADDRESS, TYCOON_IMPL_ADDRESS,
#   TYCOON_PROXY_ADDRESS, TYCOON_REWARDS_FAUCET_ADDRESS, TYCOON_GAME_FAUCET_ADDRESS,
#   TYCOON_USER_REGISTRY_ADDRESS; optional: TYCOON_NAIRA_VAULT_ADDRESS, TYCOON_AI_REGISTRY_ADDRESS,
#   TYCOON_TOURNAMENT_ESCROW_ADDRESS, TYCOON_NFT_ADDRESS.
#   TYCOON_OWNER, USDC_ADDRESS (for RewardSystem/NairaVault/Escrow args), GAME_CONTROLLER, NAIRA_VAULT_CONTROLLER (optional).

set -e
cd "$(dirname "$0")/.."
source .env

CHAIN_ID="${CHAIN_ID:-42220}"

if [ -z "$ETHERSCAN_API_KEY" ]; then
  echo "Set ETHERSCAN_API_KEY in .env (get one at https://etherscan.io/register)"
  exit 1
fi

verify() {
  forge verify-contract --chain-id "$CHAIN_ID" "$@" --etherscan-api-key "$ETHERSCAN_API_KEY" --watch
}

# 1. TycoonToken (optional)
if [ -n "$TYC_ADDRESS" ] && [ -n "$TYCOON_OWNER" ]; then
  echo "Verifying TycoonToken at $TYC_ADDRESS..."
  ARGS=$(cast abi-encode "constructor(address)" "$TYCOON_OWNER")
  verify "$TYC_ADDRESS" src/legacy/TycoonToken.sol:TycoonToken --constructor-args "$ARGS"
fi

# 2. TycoonRewardSystem (optional)
if [ -n "$TYCOON_REWARD_SYSTEM" ] && [ -n "$TYC_ADDRESS" ] && [ -n "$USDC_ADDRESS" ] && [ -n "$TYCOON_OWNER" ]; then
  echo "Verifying TycoonRewardSystem at $TYCOON_REWARD_SYSTEM..."
  ARGS=$(cast abi-encode "constructor(address,address,address)" "$TYC_ADDRESS" "$USDC_ADDRESS" "$TYCOON_OWNER")
  verify "$TYCOON_REWARD_SYSTEM" src/TycoonRewardSystem.sol:TycoonRewardSystem --constructor-args "$ARGS"
fi

# 3. TycoonUpgradeableLogic
if [ -z "$TYCOON_LOGIC_ADDRESS" ] || [ -z "$TYCOON_IMPL_ADDRESS" ]; then
  echo "Set TYCOON_LOGIC_ADDRESS and TYCOON_IMPL_ADDRESS in .env (from deploy logs)"
  exit 1
fi
echo "Verifying TycoonUpgradeableLogic at $TYCOON_LOGIC_ADDRESS..."
verify "$TYCOON_LOGIC_ADDRESS" src/TycoonUpgradeableLogic.sol:TycoonUpgradeableLogic

echo "Verifying TycoonUpgradeable (impl) at $TYCOON_IMPL_ADDRESS..."
verify "$TYCOON_IMPL_ADDRESS" src/TycoonUpgradeable.sol:TycoonUpgradeable

# 4. ERC1967Proxy (optional)
if [ -n "$TYCOON_PROXY_ADDRESS" ] && [ -n "$TYCOON_OWNER" ] && [ -n "$TYCOON_REWARD_SYSTEM" ]; then
  echo "Verifying ERC1967Proxy (game) at $TYCOON_PROXY_ADDRESS..."
  INIT_DATA=$(cast calldata "initialize(address,address)" "$TYCOON_OWNER" "$TYCOON_REWARD_SYSTEM")
  CONSTRUCTOR_ARGS=$(cast abi-encode "constructor(address,bytes)" "$TYCOON_IMPL_ADDRESS" "$INIT_DATA")
  verify "$TYCOON_PROXY_ADDRESS" \
    lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \
    --constructor-args "$CONSTRUCTOR_ARGS"
  echo "Proxy verified."
fi

# 5. TycoonRewardsFaucet (optional)
if [ -n "$TYCOON_REWARDS_FAUCET_ADDRESS" ] && [ -n "$TYCOON_REWARD_SYSTEM" ] && [ -n "$TYCOON_OWNER" ]; then
  echo "Verifying TycoonRewardsFaucet at $TYCOON_REWARDS_FAUCET_ADDRESS..."
  ARGS=$(cast abi-encode "constructor(address,address)" "$TYCOON_REWARD_SYSTEM" "$TYCOON_OWNER")
  verify "$TYCOON_REWARDS_FAUCET_ADDRESS" src/legacy/TycoonRewardsFaucet.sol:TycoonRewardsFaucet --constructor-args "$ARGS"
fi

# 6. TycoonGameFaucet (optional)
GAME_CTRL="${GAME_CONTROLLER:-$TYCOON_OWNER}"
if [ -n "$TYCOON_GAME_FAUCET_ADDRESS" ] && [ -n "$TYCOON_PROXY_ADDRESS" ] && [ -n "$TYCOON_OWNER" ]; then
  echo "Verifying TycoonGameFaucet at $TYCOON_GAME_FAUCET_ADDRESS..."
  ARGS=$(cast abi-encode "constructor(address,address,address)" "$TYCOON_PROXY_ADDRESS" "$GAME_CTRL" "$TYCOON_OWNER")
  verify "$TYCOON_GAME_FAUCET_ADDRESS" src/legacy/TycoonGameFaucet.sol:TycoonGameFaucet --constructor-args "$ARGS"
fi

# 7. TycoonUserRegistry (optional) — per-user smart wallet
if [ -n "$TYCOON_USER_REGISTRY_ADDRESS" ] && [ -n "$TYCOON_PROXY_ADDRESS" ] && [ -n "$TYCOON_REWARDS_FAUCET_ADDRESS" ] && [ -n "$TYCOON_OWNER" ]; then
  echo "Verifying TycoonUserRegistry at $TYCOON_USER_REGISTRY_ADDRESS..."
  ARGS=$(cast abi-encode "constructor(address,address,address)" "$TYCOON_PROXY_ADDRESS" "$TYCOON_REWARDS_FAUCET_ADDRESS" "$TYCOON_OWNER")
  verify "$TYCOON_USER_REGISTRY_ADDRESS" src/legacy/TycoonUserRegistry.sol:TycoonUserRegistry --constructor-args "$ARGS"
fi

# 8. TycoonNairaVault (optional)
NAIRA_CTRL="${NAIRA_VAULT_CONTROLLER:-${GAME_CONTROLLER:-$TYCOON_OWNER}}"
if [ -n "$TYCOON_NAIRA_VAULT_ADDRESS" ] && [ -n "$USDC_ADDRESS" ] && [ -n "$TYCOON_OWNER" ]; then
  echo "Verifying TycoonNairaVault at $TYCOON_NAIRA_VAULT_ADDRESS..."
  ARGS=$(cast abi-encode "constructor(address,address,address)" "$USDC_ADDRESS" "$NAIRA_CTRL" "$TYCOON_OWNER")
  verify "$TYCOON_NAIRA_VAULT_ADDRESS" src/legacy/TycoonNairaVault.sol:TycoonNairaVault --constructor-args "$ARGS"
fi

# 9. TycoonAIAgentRegistry (optional)
if [ -n "$TYCOON_AI_REGISTRY_ADDRESS" ] && [ -n "$TYCOON_OWNER" ]; then
  echo "Verifying TycoonAIAgentRegistry at $TYCOON_AI_REGISTRY_ADDRESS..."
  ARGS=$(cast abi-encode "constructor(address)" "$TYCOON_OWNER")
  verify "$TYCOON_AI_REGISTRY_ADDRESS" src/legacy/TycoonAIAgent.sol:TycoonAIAgentRegistry --constructor-args "$ARGS"
fi

# 10. TycoonTournamentEscrow (optional)
if [ -n "$TYCOON_TOURNAMENT_ESCROW_ADDRESS" ] && [ -n "$USDC_ADDRESS" ] && [ -n "$TYCOON_OWNER" ]; then
  echo "Verifying TycoonTournamentEscrow at $TYCOON_TOURNAMENT_ESCROW_ADDRESS..."
  ARGS=$(cast abi-encode "constructor(address,address)" "$USDC_ADDRESS" "$TYCOON_OWNER")
  verify "$TYCOON_TOURNAMENT_ESCROW_ADDRESS" src/legacy/TycoonTournamentEscrow.sol:TycoonTournamentEscrow --constructor-args "$ARGS"
fi

# 11. TycoonNFT (optional)
if [ -n "$TYCOON_NFT_ADDRESS" ] && [ -n "$TYCOON_OWNER" ]; then
  echo "Verifying TycoonNFT at $TYCOON_NFT_ADDRESS..."
  ARGS=$(cast abi-encode "constructor(address)" "$TYCOON_OWNER")
  verify "$TYCOON_NFT_ADDRESS" src/legacy/TycoonNFT.sol:TycoonNft --constructor-args "$ARGS"
fi

echo "Done."
