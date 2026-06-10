import type { History, Player } from "@/types/game";

/**
 * History rows use `player_name` from the API (often `users.username` for shadow bot users).
 * Agent boards already remap `livePlayers[].username` from agent bindings (Discover / Challenge / tournament).
 * Apply the same display names to the action log so it matches the player list.
 */
export function applyAgentBattleDisplayNamesToHistory(
  history: History[],
  isAgentBattle: boolean,
  livePlayers: Player[]
): History[] {
  if (!isAgentBattle || !history.length) return history;
  const idToName = new Map<number, string>();
  for (const p of livePlayers) {
    const gpid = Number(p.id);
    if (!Number.isFinite(gpid) || gpid <= 0) continue;
    const un = String(p.username ?? "").trim();
    if (un) idToName.set(gpid, un);
  }
  if (idToName.size === 0) return history;
  return history.map((entry) => {
    const resolved = idToName.get(Number(entry.game_player_id));
    if (!resolved) return entry;
    return { ...entry, player_name: resolved };
  });
}
