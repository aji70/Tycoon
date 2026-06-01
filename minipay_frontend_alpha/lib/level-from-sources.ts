/**
 * Game-count merges used for XP / level — must stay aligned with
 * `GuestProfileView` `displayStats` and connected profile `effectiveUserData`.
 */

export type BackendStatsRow = {
  id?: number;
  games_played?: number;
  game_won?: number;
  game_lost?: number;
  celo_games_played?: number;
  celo_games_won?: number;
  total_staked?: number;
  total_earned?: number;
  total_withdrawn?: number;
};

export type ContractUserStats = {
  gamesPlayed: number;
  gamesWon: number;
  totalStaked: number;
  totalEarned: number;
};

/** Matches `GuestProfileView` `displayStats` game counts (Celo-first backend fields). */
export function guestGamesForLevel(
  userData: ContractUserStats | null,
  offChain: BackendStatsRow | null | undefined
): { gamesPlayed: number; gamesWon: number } {
  const gpBackend = Number(offChain?.celo_games_played) > 0 ? Number(offChain!.celo_games_played) : Number(offChain?.games_played) ?? 0;
  const backendHasStats = Boolean(offChain?.id && (gpBackend > 0 || Number(offChain.total_earned) > 0));
  const contractEmpty =
    userData != null && userData.gamesPlayed === 0 && userData.totalStaked === 0 && userData.totalEarned === 0;

  if (contractEmpty && backendHasStats && offChain) {
    const gw = Number(offChain.celo_games_won) > 0 ? Number(offChain.celo_games_won) : Number(offChain.game_won) || 0;
    return { gamesPlayed: gpBackend, gamesWon: gw };
  }
  if (userData) return { gamesPlayed: userData.gamesPlayed, gamesWon: userData.gamesWon };
  if (backendHasStats && offChain) {
    const gw = Number(offChain.celo_games_won) > 0 ? Number(offChain.celo_games_won) : Number(offChain.game_won) || 0;
    return { gamesPlayed: gpBackend, gamesWon: gw };
  }
  return { gamesPlayed: 0, gamesWon: 0 };
}

/** Matches connected profile `effectiveUserData` game counts. */
export function walletGamesForLevel(
  userData: ContractUserStats | null,
  backend: BackendStatsRow | null | undefined,
  chainParam: string
): { gamesPlayed: number; gamesWon: number } {
  const isCelo = chainParam === 'CELO';
  const gp = isCelo && Number(backend?.celo_games_played) > 0 ? Number(backend!.celo_games_played) : Number(backend?.games_played) ?? 0;
  const gw = isCelo && Number(backend?.celo_games_won) > 0 ? Number(backend!.celo_games_won) : Number(backend?.game_won) ?? 0;
  const hasBackendStats = backend != null && (gp > 0 || Number(backend.total_earned) > 0);

  if (!userData) {
    if (hasBackendStats) return { gamesPlayed: gp, gamesWon: gw };
    return { gamesPlayed: 0, gamesWon: 0 };
  }

  const contractEmpty = userData.gamesPlayed === 0 && userData.totalStaked === 0 && userData.totalEarned === 0;
  if (contractEmpty && hasBackendStats) return { gamesPlayed: gp, gamesWon: gw };
  return { gamesPlayed: userData.gamesPlayed, gamesWon: userData.gamesWon };
}
