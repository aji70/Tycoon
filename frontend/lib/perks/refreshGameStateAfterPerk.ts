/**
 * Pull fresh game state after a perk mutates server-side player data
 * (balance, active_perks, jail, position, pending_exact_roll, etc.).
 */
export async function refreshGameStateAfterPerk(
  refresh?: (() => void | Promise<void>) | null | undefined
): Promise<void> {
  if (!refresh) return;
  try {
    await refresh();
  } catch {
    // Polling/socket will catch up; don't block the perk UX on refresh failure.
  }
}
