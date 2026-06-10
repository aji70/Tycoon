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

/** Ordered ladder for tier legend (lowest → highest); matches backend `getTierNameArena`. */
export const ARENA_TIER_LADDER: { label: string; hint: string }[] = [
  { label: "Bronze", hint: "Just getting started in the arena." },
  { label: "Silver", hint: "Building a track record." },
  { label: "Gold", hint: "Consistent wins and XP." },
  { label: "Platinum", hint: "Strong arena performance." },
  { label: "Diamond", hint: "Top-tier competitors." },
  { label: "Legend", hint: "Best of the best." },
];

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
    tierLabel: a.tier || "Bronze",
  };
}

/** Live API agents only — no curated demo roster. */
export function resolveDiscoverAgents(apiAgents: ApiArenaAgent[], excludeIds: number[]): DiscoverAgent[] {
  return apiAgents.filter((a) => !excludeIds.includes(a.id)).map(apiAgentToDiscover);
}
