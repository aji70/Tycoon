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
    return {
      rpcUrl,
      contractAddress,
      privateKey,
      chainId,
      isConfigured: Boolean(rpcUrl && contractAddress && privateKey),
    };
  }

  if (c === "POLYGON") {
    const rpcUrl = process.env.POLYGON_RPC_URL;
    const contractAddress = process.env.TYCOON_POLYGON_CONTRACT_ADDRESS;
    const privateKey = process.env.BACKEND_GAME_CONTROLLER_POLYGON_PRIVATE_KEY ?? process.env.BACKEND_GAME_CONTROLLER_PRIVATE_KEY;
    const chainId = Number(process.env.POLYGON_CHAIN_ID) || 137;
    return {
      rpcUrl,
      contractAddress,
      privateKey,
      chainId,
      isConfigured: Boolean(rpcUrl && contractAddress && privateKey),
    };
  }

  if (c === "BASE") {
    const rpcUrl = process.env.BASE_RPC_URL;
    const contractAddress = process.env.TYCOON_BASE_CONTRACT_ADDRESS;
    const privateKey = process.env.BACKEND_GAME_CONTROLLER_BASE_PRIVATE_KEY ?? process.env.BACKEND_GAME_CONTROLLER_PRIVATE_KEY;
    const chainId = Number(process.env.BASE_CHAIN_ID) || 8453;
    return {
      rpcUrl,
      contractAddress,
      privateKey,
      chainId,
      isConfigured: Boolean(rpcUrl && contractAddress && privateKey),
    };
  }

  return {
    rpcUrl: undefined,
    contractAddress: undefined,
    privateKey: undefined,
    chainId: 0,
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
