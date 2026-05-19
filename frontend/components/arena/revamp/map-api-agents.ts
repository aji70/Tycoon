import type { ArenaRank, ShowcaseAgent } from "./arena-revamp-data";
import { SHOWCASE_AGENTS } from "./arena-revamp-data";

const TIER_TO_RANK: Record<string, ArenaRank> = {
  gold: "Legend",
  cyan: "Diamond",
  yellow: "Gold",
  silver: "Silver",
  purple: "Diamond",
  brown: "Silver",
};

const EMOJIS = ["🎲", "🤖", "⚡", "🎯", "🧠", "💎", "🔥", "🌟"];

function pseudoAddress(id: number, name: string): string {
  const seed = `${id}-${name}`.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hex = seed.toString(16).padStart(40, "0").slice(0, 40);
  return `0x${hex}`;
}

export interface ApiArenaAgent {
  id: number;
  name: string;
  username: string;
  elo_rating?: number;
  xp?: number;
  arena_wins: number;
  arena_losses: number;
  tier_color: string;
  erc8004_agent_id?: string | null;
}

const ARENA_ELO_BASELINE = 1000;

function xpOf(a: ApiArenaAgent): number {
  if (a.xp != null && Number.isFinite(Number(a.xp))) return Math.max(0, Number(a.xp));
  const raw = Number(a.elo_rating);
  if (Number.isFinite(raw)) return Math.max(0, raw - ARENA_ELO_BASELINE);
  return 0;
}

export function apiAgentToShowcase(a: ApiArenaAgent, index: number): ShowcaseAgent {
  const rank = TIER_TO_RANK[String(a.tier_color || "").toLowerCase()] ?? "Silver";
  return {
    id: a.id,
    name: a.name,
    emoji: EMOJIS[index % EMOJIS.length],
    creator: a.username,
    rank,
    wins: a.arena_wins ?? 0,
    losses: a.arena_losses ?? 0,
    xp: xpOf(a),
    erc8004: Boolean(a.erc8004_agent_id),
    erc8004Score: a.erc8004_agent_id ? 85 + (a.id % 15) : undefined,
    address: pseudoAddress(a.id, a.name),
  };
}

/** Prefer live API agents; fall back to curated showcase roster for empty Discover. */
export function resolveDiscoverAgents(apiAgents: ApiArenaAgent[], excludeIds: number[]): ShowcaseAgent[] {
  const filtered = apiAgents.filter((a) => !excludeIds.includes(a.id));
  if (filtered.length > 0) {
    return filtered.map((a, i) => apiAgentToShowcase(a, i));
  }
  return SHOWCASE_AGENTS;
}
