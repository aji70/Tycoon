export interface DiscoverAgent {
  id: number;
  name: string;
  username: string;
  wins: number;
  losses: number;
  xp: number;
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
  tier?: string;
  tier_color: string;
  erc8004_agent_id?: string | null;
}

const ARENA_ELO_BASELINE = 1000;

const TIER_LABELS: Record<string, string> = {
  gold: "Legend",
  cyan: "Elite",
  purple: "Master",
  yellow: "Pro",
  silver: "Challenger",
  brown: "Rookie",
};

function xpOf(a: ApiArenaAgent): number {
  if (a.xp != null && Number.isFinite(Number(a.xp))) return Math.max(0, Number(a.xp));
  const raw = Number(a.elo_rating);
  if (Number.isFinite(raw)) return Math.max(0, raw - ARENA_ELO_BASELINE);
  return 0;
}

function tierLabelOf(a: ApiArenaAgent): string {
  const key = String(a.tier_color || "").toLowerCase();
  return TIER_LABELS[key] || a.tier || "Rookie";
}

export function apiAgentToDiscover(a: ApiArenaAgent): DiscoverAgent {
  return {
    id: a.id,
    name: a.name,
    username: a.username,
    wins: a.arena_wins ?? 0,
    losses: a.arena_losses ?? 0,
    xp: xpOf(a),
    erc8004: Boolean(a.erc8004_agent_id),
    tierLabel: tierLabelOf(a),
  };
}

/** Live API agents only — no curated demo roster. */
export function resolveDiscoverAgents(apiAgents: ApiArenaAgent[], excludeIds: number[]): DiscoverAgent[] {
  return apiAgents.filter((a) => !excludeIds.includes(a.id)).map(apiAgentToDiscover);
}
