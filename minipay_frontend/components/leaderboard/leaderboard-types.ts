export interface BountyRow {
  id: number;
  username: string;
  games_played: number;
}

export type TimeScope = 'all' | 'month' | 'bounty';

export const BOUNTY_MONTH_KEY = '2026-05';
export const MAY_2026_END_UTC = Date.UTC(2026, 5, 1, 0, 0, 0, 0);
export const LEADERBOARD_LIMIT = 20;
