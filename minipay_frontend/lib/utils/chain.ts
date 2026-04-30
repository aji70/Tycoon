/**
 * Values the backend accepts for `chain` (see `User.normalizeChain` + `getChainConfig`).
 * AppKit/wagmi often yield `chain-42220` or `unknown` when no wallet is connected — those must not be sent.
 */
export function resolveChainForBackend(
  wagmiChainId: number,
  caipNetworkName?: string | null
): "CELO" {
  return "CELO";
}
