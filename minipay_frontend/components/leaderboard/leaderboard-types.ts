export interface BountyRow {
  id: number;
  username: string;
  games_played: number;
}

export type TimeScope = 'all' | 'month' | 'bounty';

/** Active monthly bounty (June 2026). */
export const BOUNTY_MONTH_KEY = '2026-06';
export const JUNE_2026_END_UTC = Date.UTC(2026, 6, 1, 0, 0, 0, 0);

/** Completed May 2026 bounty — final standings. */
export const COMPLETED_BOUNTY_MONTH_KEY = '2026-05';

export const LEADERBOARD_LIMIT = 20;
/** Show all remaining May players beyond the top 10 prize slots. */
export const COMPLETED_BOUNTY_LIMIT = 100;
