/**
 * Tournament bracket games use codes like T7-R0-M1 and often game_type includes TOURNAMENT.
 * Used to tune UI (e.g. hide tavern chat on those boards).
 */
export function isTournamentBoardGame(
  game: { game_type?: string | null; code?: string | null } | null | undefined,
  gameCode: string | null | undefined
): boolean {
  const gt = String(game?.game_type ?? "").toUpperCase();
  if (gt.includes("TOURNAMENT")) return true;
  const c = String(gameCode ?? game?.code ?? "")
    .trim()
    .toUpperCase();
  // Bracket games use codes like T24-R0-M1 (numeric tournament id).
  if (/^T\d+-R\d+-M\d+$/.test(c)) return true;
  return false;
}
