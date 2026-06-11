/**
 * Values the backend accepts for `chain` (see `User.normalizeChain` + `getChainConfig`).
 * AppKit/wagmi often yield `chain-42220` or `unknown` when no wallet is connected — those must not be sent.
 */
export function resolveChainForBackend(
  wagmiChainId: number,
  caipNetworkName?: string | null
): "CELO" | "POLYGON" | "BASE" {
  const id = Number(wagmiChainId);
  if (id === 42220 || id === 44787) return "CELO";
  if (id === 137 || id === 80001) return "POLYGON";
  if (id === 8453 || id === 84531) return "BASE";

  const n = (caipNetworkName ?? "").toLowerCase().replace(/\s+/g, "");
  if (n.includes("celo")) return "CELO";
  if (n.includes("polygon") || n === "matic") return "POLYGON";
  if (n.includes("base")) return "BASE";

  return "CELO";
}
