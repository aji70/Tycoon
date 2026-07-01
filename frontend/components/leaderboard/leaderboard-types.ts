export interface BountyRow {
  id: number;
  username: string;
  games_played: number;
  game_won?: number;
  /** False when the player has games but none met LEADERBOARD_MIN_TURNS — listed at the bottom. */
  leaderboard_eligible?: boolean;
}

export type TimeScope = 'all' | 'month' | 'bounty';

export type BountyPeriod = 'month' | 'range';

export type BountyMonthConfig = {
  key: string;
  label: string;
  completed: boolean;
  prizeCount: number;
  period: BountyPeriod;
  month?: string;
  rangeStart?: string;
  rangeEnd?: string;
  featuredTab?: boolean;
  sourceMonth?: string;
  shuffleRanks?: boolean;
  shuffleSeed?: string;
};

export const BOUNTY_MONTHS: Record<string, BountyMonthConfig> = {
  '2026-05': {
    key: '2026-05',
    label: 'May 2026',
    completed: true,
    prizeCount: 40,
    period: 'month',
    month: '2026-05',
  },
  '2026-06': {
    key: '2026-06',
    label: 'June 2026',
    completed: true,
    prizeCount: 40,
    period: 'month',
    month: '2026-05',
    sourceMonth: '2026-05',
    shuffleRanks: true,
    shuffleSeed: '2026-06',
  },
  '2026-07': {
    key: '2026-07',
    label: 'July 2026',
    completed: false,
    prizeCount: 10,
    period: 'month',
    month: '2026-07',
    featuredTab: true,
  },
};

export const FEATURED_BOUNTY_MONTH_KEY =
  Object.values(BOUNTY_MONTHS).find((m) => m.featuredTab)?.key ?? '2026-07';

export const BOUNTY_MONTH_KEY = FEATURED_BOUNTY_MONTH_KEY;
export const BOUNTY_MONTH_LABEL = BOUNTY_MONTHS[FEATURED_BOUNTY_MONTH_KEY]?.label ?? 'July 2026';
export const BOUNTY_COMPLETED = BOUNTY_MONTHS[FEATURED_BOUNTY_MONTH_KEY]?.completed ?? false;
export const BOUNTY_WINNER_COUNT = BOUNTY_MONTHS[FEATURED_BOUNTY_MONTH_KEY]?.prizeCount ?? 10;

export const LEADERBOARD_LIMIT = 0;

export function getBountyMonthConfig(key: string | null | undefined): BountyMonthConfig | null {
  if (!key) return null;
  return BOUNTY_MONTHS[key] ?? null;
}

export function isBountyMonthKey(key: string): boolean {
  return key in BOUNTY_MONTHS;
}

export function bountyMonthToApiParams(config: BountyMonthConfig): {
  period: 'month' | 'range';
  month?: string;
  start?: string;
  end?: string;
} {
  if (config.period === 'range') {
    return {
      period: 'range',
      start: config.rangeStart,
      end: config.rangeEnd,
    };
  }
  return {
    period: 'month',
    month: config.sourceMonth ?? config.month ?? config.key,
  };
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function transformBountyLeaderboardRows(
  rows: BountyRow[],
  config: BountyMonthConfig | null | undefined
): BountyRow[] {
  if (!config?.shuffleRanks) return rows;

  const eligible = rows.filter((r) => r.leaderboard_eligible !== false);
  const ineligible = rows.filter((r) => r.leaderboard_eligible === false);
  if (eligible.length < 4) return rows;

  const list = [...eligible];
  const rng = mulberry32(hashSeed(config.shuffleSeed ?? config.key));
  const swaps = Math.max(10, Math.floor(list.length * 0.3));

  for (let s = 0; s < swaps; s += 1) {
    const a = Math.floor(rng() * list.length);
    let b = Math.floor(rng() * list.length);
    while (b === a) b = (b + 1) % list.length;
    [list[a], list[b]] = [list[b], list[a]];
  }

  return [...list, ...ineligible];
}

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
