import type { Game } from "@/types/game";

/** Arena / on-chain: you play as the human; opponent is an agent. Never auto-drive the human seat from the client. */
export function isOnchainHumanVsAgentGame(game: Game | null | undefined): boolean {
  return String(game?.game_type ?? "").toUpperCase() === "ONCHAIN_HUMAN_VS_AGENT";
}

/**
 * True when the backend stored net-worth rankings (e.g. session timer or vote-to-end).
 * Typical FINISHED-by-bankruptcy AI games omit `placements`, so the client can avoid
 * showing "Time's up" / "when time ran out" for those endings.
 */
export function gameHasRankedPlacements(game: Game | null | undefined): boolean {
  const p = game?.placements;
  const placements =
    typeof p === "string"
      ? (() => {
          try {
            const o = JSON.parse(p) as unknown;
            return o && typeof o === "object" ? (o as Record<string, unknown>) : null;
          } catch {
            return null;
          }
        })()
      : p;
  if (!placements || typeof placements !== "object") return false;
  return Object.keys(placements).length > 0;
}

export function generateGameCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }
  return code;
}
