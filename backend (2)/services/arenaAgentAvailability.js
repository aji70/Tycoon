/**
 * Before starting a new arena match, reconcile stale arena_agent_challenge_locks (and legacy assignments).
 * Agents may be in multiple concurrent arena games; we no longer block on an active lock row.
 */
import { reconcileArenaLocksForAgents } from "./arenaAgentChallengeLocks.js";

/**
 * Clears stale locks only; does not throw if agents already have other active arena games.
 */
export async function assertAgentsFreeForNewArena(userAgentIds) {
  await reconcileArenaLocksForAgents(userAgentIds);
}
