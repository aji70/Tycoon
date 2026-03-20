/**
 * Multi-chain config for Tycoon contract (Celo, Polygon, Base).
 * Each chain can have its own RPC, contract address, and optional backend game controller key.
 * Used by services/tycoonContract.js so the backend can talk to the correct chain's contract.
 */

function normalizeChainName(chain) {
  if (chain == null || String(chain).trim() === "") return "CELO";
  const s = String(chain).trim().toUpperCase();
  const n = Number(chain);
  if (s === "CELO" || n === 42220 || n === 44787) return "CELO";
  if (s === "POLYGON" || n === 137 || n === 80001) return "POLYGON";
  if (s === "BASE" || n === 8453 || n === 84531) return "BASE";
  return s;
}

/**
 * Get config for a given chain (CELO, POLYGON, BASE).
 * @param {string} chain - Chain name or chainId (e.g. "CELO", "Celo", 42220)
 * @returns {{ rpcUrl: string | undefined, contractAddress: string | undefined, privateKey: string | undefined, chainId: number, isConfigured: boolean }}
 */
export function getChainConfig(chain) {
  const c = normalizeChainName(chain);

  if (c === "CELO") {
    const rpcUrl = process.env.CELO_RPC_URL;
    const contractAddress = process.env.TYCOON_CELO_CONTRACT_ADDRESS;
    const privateKey = process.env.BACKEND_GAME_CONTROLLER_PRIVATE_KEY ?? process.env.BACKEND_GAME_CONTROLLER_CELO_PRIVATE_KEY;
    const chainId = Number(process.env.CELO_CHAIN_ID) || 42220;
    const tournamentEscrowAddress = process.env.TOURNAMENT_ESCROW_ADDRESS_CELO ?? process.env.TOURNAMENT_ESCROW_CELO;
    const userRegistryAddress = process.env.TYCOON_USER_REGISTRY_CELO ?? process.env.TYCOON_USER_REGISTRY_ADDRESS;
    const nairaVaultAddress = process.env.TYCOON_NAIRA_VAULT_CELO ?? process.env.TYCOON_NAIRA_VAULT_ADDRESS;
    const gameFaucetAddress =
      process.env.TYCOON_GAME_FAUCET_ADDRESS_CELO ??
      process.env.TYCOON_GAME_FAUCET_CELO ??
      process.env.TYCOON_GAME_FAUCET_ADDRESS;
    const usdcAddress = process.env.CELO_USDC_ADDRESS ?? process.env.USDC_ADDRESS;
    return {
      rpcUrl,
      contractAddress,
      privateKey,
      chainId,
      tournamentEscrowAddress: tournamentEscrowAddress || undefined,
      userRegistryAddress: userRegistryAddress || undefined,
      nairaVaultAddress: nairaVaultAddress || undefined,
      gameFaucetAddress: gameFaucetAddress || undefined,
      usdcAddress: usdcAddress || undefined,
      isConfigured: Boolean(rpcUrl && contractAddress && privateKey),
    };
  }

  if (c === "POLYGON") {
    const rpcUrl = process.env.POLYGON_RPC_URL;
    const contractAddress = process.env.TYCOON_POLYGON_CONTRACT_ADDRESS;
    const privateKey = process.env.BACKEND_GAME_CONTROLLER_POLYGON_PRIVATE_KEY ?? process.env.BACKEND_GAME_CONTROLLER_PRIVATE_KEY;
    const chainId = Number(process.env.POLYGON_CHAIN_ID) || 137;
    const tournamentEscrowAddress = process.env.TOURNAMENT_ESCROW_ADDRESS_POLYGON ?? process.env.TOURNAMENT_ESCROW_POLYGON;
    const userRegistryAddress = process.env.TYCOON_USER_REGISTRY_POLYGON;
    const gameFaucetAddress = process.env.TYCOON_GAME_FAUCET_ADDRESS_POLYGON ?? process.env.TYCOON_GAME_FAUCET_POLYGON;
    const usdcAddress = process.env.POLYGON_USDC_ADDRESS ?? process.env.USDC_ADDRESS;
    return {
      rpcUrl,
      contractAddress,
      privateKey,
      chainId,
      tournamentEscrowAddress: tournamentEscrowAddress || undefined,
      userRegistryAddress: userRegistryAddress || undefined,
      gameFaucetAddress: gameFaucetAddress || undefined,
      usdcAddress: usdcAddress || undefined,
      isConfigured: Boolean(rpcUrl && contractAddress && privateKey),
    };
  }

  if (c === "BASE") {
    const rpcUrl = process.env.BASE_RPC_URL;
    const contractAddress = process.env.TYCOON_BASE_CONTRACT_ADDRESS;
    const privateKey = process.env.BACKEND_GAME_CONTROLLER_BASE_PRIVATE_KEY ?? process.env.BACKEND_GAME_CONTROLLER_PRIVATE_KEY;
    const chainId = Number(process.env.BASE_CHAIN_ID) || 8453;
    const tournamentEscrowAddress = process.env.TOURNAMENT_ESCROW_ADDRESS_BASE ?? process.env.TOURNAMENT_ESCROW_BASE;
    const userRegistryAddress = process.env.TYCOON_USER_REGISTRY_BASE;
    const gameFaucetAddress = process.env.TYCOON_GAME_FAUCET_ADDRESS_BASE ?? process.env.TYCOON_GAME_FAUCET_BASE;
    const usdcAddress = process.env.BASE_USDC_ADDRESS ?? process.env.USDC_ADDRESS;
    return {
      rpcUrl,
      contractAddress,
      privateKey,
      chainId,
      tournamentEscrowAddress: tournamentEscrowAddress || undefined,
      userRegistryAddress: userRegistryAddress || undefined,
      gameFaucetAddress: gameFaucetAddress || undefined,
      usdcAddress: usdcAddress || undefined,
      isConfigured: Boolean(rpcUrl && contractAddress && privateKey),
    };
  }

  return {
    rpcUrl: undefined,
    contractAddress: undefined,
    privateKey: undefined,
    chainId: 0,
    tournamentEscrowAddress: undefined,
    userRegistryAddress: undefined,
    isConfigured: false,
  };
}

/**
 * True if at least one chain is configured (backward compatibility).
 */
export function isAnyChainConfigured() {
  return (
    getChainConfig("CELO").isConfigured ||
    getChainConfig("POLYGON").isConfigured ||
    getChainConfig("BASE").isConfigured
  );
}

/** Supported chain names for contract operations */
export const SUPPORTED_CHAINS = ["CELO", "POLYGON", "BASE"];
