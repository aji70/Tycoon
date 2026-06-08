export interface BountyRow {
  id: number;
  username: string;
  games_played: number;
}

export type TimeScope = 'all' | 'month' | 'bounty';

/** Featured bounty month (default Bounty tab). */
export const BOUNTY_MONTH_KEY = '2026-05';
export const BOUNTY_MONTH_LABEL = 'May 2026';

/** May bounty has ended — show final standings on the Bounty tab. */
export const BOUNTY_COMPLETED = true;

export const LEADERBOARD_LIMIT = 20;
/** Prize winners shown in the featured bounty section. */
export const BOUNTY_WINNER_COUNT = 10;
/** Full May standings (top 10 + remaining players). */
export const COMPLETED_BOUNTY_LIMIT = 100;
