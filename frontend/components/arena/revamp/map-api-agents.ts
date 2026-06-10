export type ArenaTierKey = "rookie" | "challenger" | "pro" | "master" | "elite" | "legend";

export interface DiscoverAgent {
  id: number;
  name: string;
  username: string;
  wins: number;
  losses: number;
  draws: number;
  xp: number;
  winRatePct: number | null;
  erc8004: boolean;
  tierLabel: string;
  tierKey: ArenaTierKey;
}

export interface ApiArenaAgent {
  id: number;
  name: string;
  username: string;
  elo_rating?: number;
  xp?: number;
  arena_wins: number;
  arena_losses: number;
  arena_draws?: number;
  win_rate_pct?: number | null;
  tier?: string;
  tier_color: string;
  erc8004_agent_id?: string | null;
}

/** Arena display tiers (UI only — maps from API tier / XP bands). */
export const ARENA_TIER_LADDER: { label: string; key: ArenaTierKey; hint: string }[] = [
  { label: "ROOKIE", key: "rookie", hint: "Just getting started in the arena." },
  { label: "CHALLENGER", key: "challenger", hint: "Building a track record." },
  { label: "PRO", key: "pro", hint: "Consistent wins and XP." },
  { label: "MASTER", key: "master", hint: "Strong arena performance." },
  { label: "ELITE", key: "elite", hint: "Top-tier competitors." },
  { label: "LEGEND", key: "legend", hint: "Best of the best." },
];

const API_TIER_TO_ARENA: Record<string, ArenaTierKey> = {
  Bronze: "rookie",
  Silver: "challenger",
  Gold: "pro",
  Platinum: "master",
  Diamond: "elite",
  Legend: "legend",
  ROOKIE: "rookie",
  Rookie: "rookie",
  CHALLENGER: "challenger",
  Challenger: "challenger",
  PRO: "pro",
  Pro: "pro",
  MASTER: "master",
  Master: "master",
  ELITE: "elite",
  Elite: "elite",
  LEGEND: "legend",
};

function tierFromXp(xp: number): ArenaTierKey {
  if (xp >= 12000) return "legend";
  if (xp >= 8500) return "elite";
  if (xp >= 5500) return "master";
  if (xp >= 3000) return "pro";
  if (xp > 0) return "challenger";
  return "rookie";
}

function resolveArenaTier(apiTier: string | undefined, xp: number): { label: string; key: ArenaTierKey } {
  const key = (apiTier && API_TIER_TO_ARENA[apiTier]) || tierFromXp(xp);
  const entry = ARENA_TIER_LADDER.find((t) => t.key === key);
  return { label: entry?.label ?? "ROOKIE", key };
}

export function apiAgentToDiscover(a: ApiArenaAgent): DiscoverAgent {
  const wins = a.arena_wins ?? 0;
  const losses = a.arena_losses ?? 0;
  const draws = a.arena_draws ?? 0;
  const xp = a.xp != null && Number.isFinite(Number(a.xp)) ? Math.max(0, Number(a.xp)) : 0;
  const winRatePct =
    a.win_rate_pct != null && Number.isFinite(Number(a.win_rate_pct))
      ? Number(a.win_rate_pct)
      : wins + losses + draws > 0
        ? Math.round((wins / (wins + losses + draws)) * 1000) / 10
        : null;
  const tier = resolveArenaTier(a.tier, xp);

  return {
    id: a.id,
    name: a.name,
    username: a.username,
    wins,
    losses,
    draws,
    xp,
    winRatePct,
    erc8004: Boolean(a.erc8004_agent_id),
    tierLabel: tier.label,
    tierKey: tier.key,
  };
}

/** Live API agents only — no curated demo roster. */
export function resolveDiscoverAgents(apiAgents: ApiArenaAgent[], excludeIds: number[]): DiscoverAgent[] {
  return apiAgents.filter((a) => !excludeIds.includes(a.id)).map(apiAgentToDiscover);
}
