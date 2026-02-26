/**
 * Celo Tycoon contract config (env-based).
 * Delegates to multi-chain config for CELO. Kept for backward compatibility.
 */
import { getChainConfig } from "./chains.js";

export function getCeloConfig() {
  const { rpcUrl, contractAddress, privateKey, isConfigured } = getChainConfig("CELO");
  return { rpcUrl, contractAddress, privateKey, isConfigured };
}
