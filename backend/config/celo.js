/**
 * Celo & Tycoon contract config (env-based).
 * Used by services/tycoonContract.js for backend game controller actions.
 */
export function getCeloConfig() {
  const rpcUrl = process.env.CELO_RPC_URL;
  const contractAddress = process.env.TYCOON_CELO_CONTRACT_ADDRESS;
  const privateKey = process.env.BACKEND_GAME_CONTROLLER_PRIVATE_KEY;

  return {
    rpcUrl,
    contractAddress,
    privateKey,
    /** True if all required vars are set and backend can call the contract */
    isConfigured: Boolean(rpcUrl && contractAddress && privateKey),
  };
}
