/**
 * One active arena challenge per user_agent: enforced via arena_agent_challenge_locks (+ reconcile / stale release).
 */
import {
  reconcileArenaLocksForAgents,
  findBusyAgentInArenaLocks,
} from "./arenaAgentChallengeLocks.js";

/**
 * @throws {Error} with code AGENT_BUSY_IN_ARENA, gameCode, gameId, busyAgentId, busyAgentName
 */
export async function assertAgentsFreeForNewArena(userAgentIds) {
  await reconcileArenaLocksForAgents(userAgentIds);
  const busy = await findBusyAgentInArenaLocks(userAgentIds);
  if (!busy) return;

  const name = busy.agent_name ? String(busy.agent_name) : `Agent #${busy.user_agent_id}`;
  const code = busy.game_code ? String(busy.game_code) : "";
  const err = new Error(
    `${name} is already in an active arena game${code ? ` (code ${code})` : ""}. Wait until that match finishes, or start with a different agent.`
  );
  err.code = "AGENT_BUSY_IN_ARENA";
  err.gameCode = code || null;
  err.gameId = Number(busy.game_id);
  err.busyAgentId = Number(busy.user_agent_id);
  err.busyAgentName = name;
  throw err;
}
