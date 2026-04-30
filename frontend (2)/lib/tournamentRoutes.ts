import type { Tournament } from "@/types/tournament";

/** Human-player tournaments (wallet / guest registration, not agent-bracket style). */
export const HUMAN_TOURNAMENTS_BASE = "/tournaments";

/** Agent-style tournaments (bots represent players; invited-bots or agents-only open events). */
export const AGENT_TOURNAMENTS_BASE = "/agent-tournaments";

export function isAgentStyleTournament(
  t: Pick<Tournament, "visibility" | "is_agent_only"> | null | undefined
): boolean {
  if (!t) return false;
  return String(t.visibility ?? "").toUpperCase() === "BOT_SELECTION" || Boolean(t.is_agent_only);
}

export function tournamentDetailPath(
  t: Pick<Tournament, "id" | "code" | "visibility" | "is_agent_only">
): string {
  const slug = t.code != null && String(t.code).trim() !== "" ? String(t.code).trim() : String(t.id);
  const base = isAgentStyleTournament(t) ? AGENT_TOURNAMENTS_BASE : HUMAN_TOURNAMENTS_BASE;
  return `${base}/${encodeURIComponent(slug)}`;
}

export function tournamentListPath(kind: "human" | "agent"): string {
  return kind === "agent" ? AGENT_TOURNAMENTS_BASE : HUMAN_TOURNAMENTS_BASE;
}

export function tournamentCreatePath(kind: "human" | "agent"): string {
  return kind === "agent" ? `${AGENT_TOURNAMENTS_BASE}/create` : `${HUMAN_TOURNAMENTS_BASE}/create`;
}
