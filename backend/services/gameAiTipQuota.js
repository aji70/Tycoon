/**
 * Per-player AI tip quota within a single game (LLM tips only).
 * Default: 3 free Claude tips per game_id + user_id.
 */

import db from "../config/database.js";

export const TIPS_PER_GAME = Math.max(0, Number(process.env.AI_TIPS_PER_GAME) || 3);

/**
 * @param {number} gameId
 * @param {number} userId
 * @returns {Promise<{ used: number; remaining: number; limit: number; allowed: boolean }>}
 */
export async function getTipQuota(gameId, userId) {
  const limit = TIPS_PER_GAME;
  if (!gameId || !userId || limit <= 0) {
    return { used: 0, remaining: limit, limit, allowed: limit > 0 };
  }
  const row = await db("game_ai_tip_usage").where({ game_id: gameId, user_id: userId }).first();
  const used = row ? Number(row.tip_count) || 0 : 0;
  const remaining = Math.max(0, limit - used);
  return { used, remaining, limit, allowed: remaining > 0 };
}

/**
 * Atomically consume one tip if under the per-game cap.
 * @returns {Promise<{ ok: boolean; used: number; remaining: number; limit: number }>}
 */
export async function tryConsumeTip(gameId, userId) {
  const limit = TIPS_PER_GAME;
  if (!gameId || !userId || limit <= 0) {
    return { ok: false, used: 0, remaining: 0, limit };
  }

  // Ensure row exists
  const existing = await db("game_ai_tip_usage").where({ game_id: gameId, user_id: userId }).first();
  if (!existing) {
    try {
      await db("game_ai_tip_usage").insert({
        game_id: gameId,
        user_id: userId,
        tip_count: 0,
      });
    } catch {
      // race: row created by another request
    }
  }

  const updated = await db("game_ai_tip_usage")
    .where({ game_id: gameId, user_id: userId })
    .where("tip_count", "<", limit)
    .update({ tip_count: db.raw("tip_count + 1"), updated_at: db.fn.now() });

  if (!updated) {
    const row = await db("game_ai_tip_usage").where({ game_id: gameId, user_id: userId }).first();
    const used = row ? Number(row.tip_count) || 0 : limit;
    return { ok: false, used, remaining: 0, limit };
  }

  const row = await db("game_ai_tip_usage").where({ game_id: gameId, user_id: userId }).first();
  const used = row ? Number(row.tip_count) || 0 : 1;
  return { ok: true, used, remaining: Math.max(0, limit - used), limit };
}
