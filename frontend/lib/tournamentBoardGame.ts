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

/** Parse `T{numericId}-R{r}-M{m}` → tournament primary key (not invite code). */
export function parseTournamentIdFromBracketGameCode(
  gameCode: string | null | undefined
): number | null {
  const c = String(gameCode ?? "").trim().toUpperCase();
  const m = /^T(\d+)-R\d+-M\d+$/.exec(c);
  if (!m) return null;
  const tid = Number(m[1]);
  return Number.isInteger(tid) && tid > 0 ? tid : null;
}

/** Optional fields returned by GET /games/code/:code for tournament tables (see backend enrich). */
export type TournamentLobbyExitGameFields = {
  code?: string | null;
  game_type?: string | null;
  tournament_id?: number | null;
  tournament_code?: string | null;
};

/**
 * After a bracket table ends, send players/spectators back to the tournament lobby URL (invite code when available).
 * Uses `tournament_code` from the API when present so the URL matches the shareable lobby (`/tournaments/{code}`).
 * Non-tournament games fall back to home.
 */
export function getTournamentBracketExitHref(
  gameCode: string | null | undefined,
  game?: TournamentLobbyExitGameFields | null
): string {
  const tc =
    game?.tournament_code != null && String(game.tournament_code).trim() !== ""
      ? String(game.tournament_code).trim().toUpperCase()
      : null;
  if (tc) return `/tournaments/${encodeURIComponent(tc)}`;

  const c = String(gameCode ?? game?.code ?? "")
    .trim()
    .toUpperCase();
  const fromCode = parseTournamentIdFromBracketGameCode(c);
  if (fromCode != null) return `/tournaments/${fromCode}`;

  const tid = game?.tournament_id;
  if (typeof tid === "number" && Number.isInteger(tid) && tid > 0) return `/tournaments/${tid}`;

  return "/";
}
