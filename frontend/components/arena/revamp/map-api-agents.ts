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

export const ARENA_TIER_LABELS: Record<string, string> = {
  gold: "Legend",
  cyan: "Elite",
  purple: "Master",
  yellow: "Pro",
  silver: "Challenger",
  brown: "Rookie",
};

/** Ordered ladder for tier legend (lowest → highest). */
export const ARENA_TIER_LADDER: { label: string; hint: string }[] = [
  { label: "Rookie", hint: "Just getting started in the arena." },
  { label: "Challenger", hint: "Building a track record." },
  { label: "Pro", hint: "Consistent wins and XP." },
  { label: "Master", hint: "Strong arena performance." },
  { label: "Elite", hint: "Top-tier competitors." },
  { label: "Legend", hint: "Best of the best." },
];

const TIER_LABELS = ARENA_TIER_LABELS;

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
