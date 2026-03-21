/**
 * Tracks which arena (or autonomous tournament) game each user_agent is tied to.
 * Stale games past ARENA_AGENT_LOCK_STALE_MINUTES (default 30) are auto-cancelled so the bot can enter a new match.
 */
import db from "../config/database.js";
import agentRegistry from "./agentRegistry.js";
import Game from "../models/Game.js";
import logger from "../config/logger.js";
import { invalidateGameById } from "../utils/gameCache.js";

const TABLE = "arena_agent_challenge_locks";

/** Game types that participate in per-bot arena locks. */
export const LOCKED_ARENA_GAME_TYPES = [
  "ONCHAIN_AGENT_VS_AGENT",
  "ONCHAIN_HUMAN_VS_AGENT",
  "AGENT_VS_AGENT",
  "TOURNAMENT_AGENT_VS_AGENT",
];

const ACTIVE_GAME_STATUSES = ["PENDING", "RUNNING", "IN_PROGRESS"];

function staleThresholdMs() {
  const m = Number(process.env.ARENA_AGENT_LOCK_STALE_MINUTES);
  const minutes = Number.isFinite(m) && m > 0 ? m : 30;
  return minutes * 60 * 1000;
}

function gameStartedAtMs(game) {
  if (!game) return Date.now();
  if (game.started_at) return new Date(game.started_at).getTime();
  if (game.created_at) return new Date(game.created_at).getTime();
  return Date.now();
}

function isGameStale(game) {
  return Date.now() - gameStartedAtMs(game) > staleThresholdMs();
}

function isActiveArenaGame(game) {
  if (!game) return false;
  const st = String(game.status || "");
  const gt = String(game.game_type || "");
  return ACTIVE_GAME_STATUSES.includes(st) && LOCKED_ARENA_GAME_TYPES.includes(gt);
}

/**
 * @param {number} gameId
 */
export async function releaseLocksByGameId(gameId) {
  const id = Number(gameId);
  if (!id) return 0;
  try {
    return await db(TABLE).where({ game_id: id }).del();
  } catch (err) {
    logger.warn({ err: err?.message, gameId: id }, "releaseLocksByGameId failed");
    return 0;
  }
}

/**
 * @param {number} gameId
 * @param {number[]} userAgentIds
 */
export async function upsertArenaLocksForGame(gameId, userAgentIds) {
  const gid = Number(gameId);
  const ids = [...new Set((userAgentIds || []).map(Number).filter((n) => n > 0))];
  if (!gid || !ids.length) return;
  const now = new Date();
  for (const uid of ids) {
    const existing = await db(TABLE).where({ user_agent_id: uid }).first();
    if (existing) {
      await db(TABLE)
        .where({ user_agent_id: uid })
        .update({ game_id: gid, locked_at: now, updated_at: now });
    } else {
      await db(TABLE).insert({
        user_agent_id: uid,
        game_id: gid,
        locked_at: now,
        created_at: now,
        updated_at: now,
      });
    }
  }
}

/**
 * Cancel a stuck arena game (DB + slot assignments + challenge locks).
 * For on-chain arena games, prefer finishing by net worth + removePlayerFromGame so funds are not left on the contract.
 * @param {object} game - row from games
 * @returns {Promise<boolean>}
 */
export async function cancelStaleArenaGame(game) {
  const id = Number(game?.id);
  if (!id) return false;

  const fresh = await Game.findById(id);
  if (!fresh || !ACTIVE_GAME_STATUSES.includes(fresh.status)) return false;

  const gt = String(fresh.game_type || "");
  const isOnchainArena =
    fresh.is_ai === false &&
    (gt === "ONCHAIN_AGENT_VS_AGENT" || gt === "ONCHAIN_HUMAN_VS_AGENT") &&
    !!(String(fresh.contract_game_id || "").trim() || String(fresh.code || "").trim());

  if (isOnchainArena) {
    try {
      const { finishGameByNetWorthAndNotify } = await import("../controllers/gameController.js");
      const settled = await finishGameByNetWorthAndNotify(null, fresh);
      if (settled) {
        await invalidateGameById(id).catch(() => {});
        logger.info({ gameId: id, code: fresh.code }, "Stale on-chain arena settled (net worth + contract payouts)");
        return true;
      }
    } catch (err) {
      logger.warn({ err: err?.message, gameId: id }, "Stale arena net-worth settle failed; falling back to CANCELLED");
    }
  }

  const rowCount = await db("games")
    .where({ id })
    .whereIn("status", ACTIVE_GAME_STATUSES)
    .update({
      status: "CANCELLED",
      winner_id: null,
      next_player_id: null,
      updated_at: db.fn.now(),
    });

  if (rowCount === 0) return false;

  await invalidateGameById(id).catch(() => {});
  await agentRegistry.cleanupGame(id);
  logger.info({ gameId: id, code: game.code }, "Arena game auto-cancelled (stale agent lock, no on-chain settle)");
  return true;
}

/**
 * Legacy: busy via agent_slot_assignments (no lock row yet).
 * @param {number} userAgentId
 */
async function findLegacyAssignmentRow(userAgentId) {
  const id = Number(userAgentId);
  if (!id) return null;

  return db("agent_slot_assignments as asa")
    .join("games as g", "g.id", "asa.game_id")
    .leftJoin("user_agents as ua", "ua.id", "asa.user_agent_id")
    .where("asa.user_agent_id", id)
    .where("asa.game_id", ">", 0)
    .whereIn("g.game_type", LOCKED_ARENA_GAME_TYPES)
    .whereIn("g.status", ACTIVE_GAME_STATUSES)
    .whereExists(function whereGameHasPlayers() {
      this.select(db.raw("1")).from("game_players as gp").whereColumn("gp.game_id", "g.id");
    })
    .select(
      "asa.user_agent_id",
      "ua.name as agent_name",
      "g.id as game_id",
      "g.code as game_code",
      "g.status as game_status",
      "g.game_type",
      "g.started_at",
      "g.created_at"
    )
    .first();
}

async function reconcileLockRow(userAgentId) {
  const lock = await db(TABLE).where({ user_agent_id: Number(userAgentId) }).first();
  if (!lock) return;

  const game = await Game.findById(lock.game_id);
  if (!isActiveArenaGame(game)) {
    await db(TABLE).where({ user_agent_id: Number(userAgentId) }).del();
    return;
  }

  const pcRow = await db("game_players").where({ game_id: game.id }).count("* as c").first();
  const playerCount = Number(pcRow?.c ?? 0);
  if (playerCount === 0) {
    await cancelStaleArenaGame(game);
    return;
  }

  if (isGameStale(game)) {
    await cancelStaleArenaGame(game);
  }
}

async function reconcileLegacyAssignment(userAgentId) {
  const row = await findLegacyAssignmentRow(userAgentId);
  if (!row) return;

  const game = await Game.findById(row.game_id);
  if (!game || !isActiveArenaGame(game)) return;

  if (isGameStale(game)) {
    await cancelStaleArenaGame(game);
    return;
  }

  await upsertArenaLocksForGame(game.id, [userAgentId]);
}

/**
 * Expire stale locks / legacy assignments for these agents so a new arena can start.
 * @param {number[]} userAgentIds
 */
export async function reconcileArenaLocksForAgents(userAgentIds) {
  const ids = [...new Set((userAgentIds || []).map(Number).filter((n) => n > 0))];
  for (const id of ids) {
    await reconcileLockRow(id);
    await reconcileLegacyAssignment(id);
  }
}

/**
 * @param {number[]} userAgentIds
 * @returns {Promise<{ user_agent_id: number, agent_name: string | null, game_id: number, game_code: string | null, game_status: string } | null>}
 */
export async function findBusyAgentInArenaLocks(userAgentIds) {
  const ids = [...new Set((userAgentIds || []).map(Number).filter((n) => n > 0))];
  if (!ids.length) return null;

  return db(`${TABLE} as acl`)
    .join("games as g", "g.id", "acl.game_id")
    .leftJoin("user_agents as ua", "ua.id", "acl.user_agent_id")
    .whereIn("acl.user_agent_id", ids)
    .whereIn("g.status", ACTIVE_GAME_STATUSES)
    .whereIn("g.game_type", LOCKED_ARENA_GAME_TYPES)
    .whereExists(function lockGameHasPlayers() {
      this.select(db.raw("1")).from("game_players as gp").whereColumn("gp.game_id", "g.id");
    })
    .select(
      "acl.user_agent_id",
      "ua.name as agent_name",
      "g.id as game_id",
      "g.code as game_code",
      "g.status as game_status"
    )
    .first();
}
