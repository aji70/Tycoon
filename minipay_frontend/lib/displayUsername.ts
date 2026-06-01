/** Backend-sponsored names often look like `PlayerName_id42` — hide suffix in UI when DB has a clean name. */
const ON_CHAIN_ID_SUFFIX = /_id\d+$/i;

/**
 * Label for UI: prefer backend/profile username; avoid showing `name_id123` when DB has `name`.
 */
export function preferDisplayUsername(
  dbUsername?: string | null,
  onChainUsername?: string | null,
  fallback = "Player"
): string {
  const db = dbUsername?.trim();
  if (db) return db;

  const onChain = onChainUsername?.trim();
  if (!onChain) return fallback;

  if (!ON_CHAIN_ID_SUFFIX.test(onChain)) return onChain;

  const withoutSuffix = onChain.replace(ON_CHAIN_ID_SUFFIX, "");
  return withoutSuffix.length > 0 ? withoutSuffix : onChain;
}
