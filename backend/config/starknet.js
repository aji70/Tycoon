/**
 * Starknet (Cairo/Dojo) config for backend.
 * Used by services/starknetContract.js to call Tycoon Dojo contracts on Starknet Sepolia.
 *
 * Env:
 *   STARKNET_RPC_URL - Starknet Sepolia RPC (e.g. https://starknet-sepolia-rpc.publicnode.com)
 *   BACKEND_STARKNET_PRIVATE_KEY - Backend wallet private key (hex, with or without 0x)
 *   BACKEND_STARKNET_ACCOUNT_ADDRESS - Backend wallet address (optional; can be derived from key)
 *
 * Contract addresses match frontend Dojo manifest (manifest_sepolia.json).
 */
const DEFAULT_RPC = "https://starknet-sepolia-rpc.publicnode.com";

const DOJO_GAME_ADDRESS =
  process.env.STARKNET_DOJO_GAME_ADDRESS ??
  "0x5a31a881755ac573ede94e35d6c16e72d3892745d2600f352b5e956fde817f";
const DOJO_PLAYER_ADDRESS =
  process.env.STARKNET_DOJO_PLAYER_ADDRESS ??
  "0x29dff7a557a1179b8c2ae9e79d82b4eeadb2d007011310e0b7b03327b074bbf";

export function getStarknetConfig() {
  const rpcUrl = process.env.STARKNET_RPC_URL ?? DEFAULT_RPC;
  const privateKey = process.env.BACKEND_STARKNET_PRIVATE_KEY;
  const accountAddress = process.env.BACKEND_STARKNET_ACCOUNT_ADDRESS;

  return {
    rpcUrl,
    privateKey: privateKey ?? undefined,
    accountAddress: accountAddress ?? undefined,
    gameAddress: DOJO_GAME_ADDRESS,
    playerAddress: DOJO_PLAYER_ADDRESS,
    isConfigured: Boolean(rpcUrl && privateKey),
  };
}
