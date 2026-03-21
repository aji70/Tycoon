/**
 * One active arena challenge per user_agent: block new on-chain arena if agent is already seated in RUNNING/PENDING game.
 */
import db from "../config/database.js";

const ARENA_GAME_TYPES = ["ONCHAIN_AGENT_VS_AGENT", "ONCHAIN_HUMAN_VS_AGENT", "AGENT_VS_AGENT"];

/**
 * @param {number[]} userAgentIds
 * @returns {Promise<{ user_agent_id: number, agent_name: string | null, game_id: number, game_code: string | null, game_status: string } | null>}
 */
export async function findAgentBusyInActiveArena(userAgentIds) {
  const ids = [...new Set((userAgentIds || []).map(Number).filter((n) => n > 0))];
  if (!ids.length) return null;

  const row = await db("agent_slot_assignments as asa")
    .join("games as g", "g.id", "asa.game_id")
    .leftJoin("user_agents as ua", "ua.id", "asa.user_agent_id")
    .whereIn("asa.user_agent_id", ids)
    .where("asa.game_id", ">", 0)
    .whereIn("g.game_type", ARENA_GAME_TYPES)
    .whereIn("g.status", ["RUNNING", "PENDING"])
    .select(
      "asa.user_agent_id",
      "ua.name as agent_name",
      "g.id as game_id",
      "g.code as game_code",
      "g.status as game_status"
    )
    .first();

  return row || null;
}

/**
 * @throws {Error} with code AGENT_BUSY_IN_ARENA, gameCode, gameId, busyAgentId, busyAgentName
 */
export async function assertAgentsFreeForNewArena(userAgentIds) {
  const busy = await findAgentBusyInActiveArena(userAgentIds);
  if (!busy) return;

  const name = busy.agent_name ? String(busy.agent_name) : `Agent #${busy.user_agent_id}`;
  const code = busy.game_code ? String(busy.game_code) : "";
  const err = new Error(
    `${name} is already in an active arena game${code ? ` (${code})` : ""}. Open the board to spectate or wait until it finishes.`
  );
  err.code = "AGENT_BUSY_IN_ARENA";
  err.gameCode = code || null;
  err.gameId = Number(busy.game_id);
  err.busyAgentId = Number(busy.user_agent_id);
  err.busyAgentName = name;
  throw err;
}
