export interface BountyRow {
  id: number;
  username: string;
  games_played: number;
  game_won?: number;
  /** False when the player has games but none met LEADERBOARD_MIN_TURNS — listed at the bottom. */
  leaderboard_eligible?: boolean;
}

export type TimeScope = 'all' | 'month' | 'bounty';

/** Featured bounty month (default Bounty tab). */
export const BOUNTY_MONTH_KEY = '2026-07';
export const BOUNTY_MONTH_LABEL = 'July 2026';

/** When true, bounty tab shows final standings (prizes paid). When false, live competition. */
export const BOUNTY_COMPLETED = false;

/** 0 = fetch all players with finished games (no display cap). */
export const LEADERBOARD_LIMIT = 0;
/** Prize winners shown in the featured bounty section. */
export const BOUNTY_WINNER_COUNT = 10;

export type LeaderboardApiMeta = {
  lastUpdatedAt: string | null;
  snapshotDate: string | null;
  live: boolean;
};

export function formatLeaderboardLastUpdated(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

export function parseLeaderboardApiResponse(res: unknown): {
  rows: BountyRow[];
  meta: LeaderboardApiMeta;
} {
  const envelope = (res as { data?: unknown })?.data;
  let payload: unknown = envelope;
  let lastUpdatedAt: string | null = null;
  let snapshotDate: string | null = null;
  let live = false;

  if (envelope && typeof envelope === 'object' && !Array.isArray(envelope)) {
    const obj = envelope as {
      data?: unknown;
      lastUpdatedAt?: string;
      snapshotDate?: string;
      live?: boolean;
    };
    if (Array.isArray(obj.data)) {
      payload = obj.data;
      lastUpdatedAt = obj.lastUpdatedAt ?? null;
      snapshotDate = obj.snapshotDate ?? null;
      live = Boolean(obj.live);
    }
  }

  let list: unknown = payload;
  if (Array.isArray(payload)) {
    list = payload;
  } else if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown[] }).data)) {
    list = (payload as { data: unknown[] }).data;
  } else if (payload && typeof payload === 'object' && Array.isArray((payload as { leaderboard?: unknown[] }).leaderboard)) {
    list = (payload as { leaderboard: unknown[] }).leaderboard;
  }

  if (!Array.isArray(list)) {
    return {
      rows: [],
      meta: { lastUpdatedAt, snapshotDate, live },
    };
  }

  const rows = list.map((row: Record<string, unknown>, index: number) => ({
    id: Number(row.id ?? index),
    username: String(row.username ?? '—'),
    games_played: Number(row.games_played ?? 0),
    game_won: row.game_won != null ? Number(row.game_won) : undefined,
    leaderboard_eligible: row.leaderboard_eligible !== false,
  }));

  return { rows, meta: { lastUpdatedAt, snapshotDate, live } };
}
