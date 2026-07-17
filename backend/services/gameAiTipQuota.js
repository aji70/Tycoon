/**
 * Per-player AI tip quota within a single game (LLM tips only).
 * Default: 3 free Claude tips per game_id + user_id.
 * Packs: +5 tips for $0.05 USDC (see tipPackPurchase).
 */

import db from "../config/database.js";
import { isUsdcCreditsConfigured } from "./verifyUsdcTransfer.js";

export const TIPS_PER_GAME = Math.max(0, Number(process.env.AI_TIPS_PER_GAME) || 3);
export const TIP_PACK_TIPS = Math.max(1, Number(process.env.AI_TIP_PACK_TIPS) || 5);
/** USDC amount as decimal string (6 decimals on-chain). */
export const TIP_PACK_USDC = String(process.env.AI_TIP_PACK_USDC || "0.05");
/** Minimum on-chain units (6 decimals): 0.05 USDC = 50_000. */
export const TIP_PACK_USDC_UNITS = BigInt(
  Math.round(Number(TIP_PACK_USDC) * 1_000_000)
);

/**
 * Offer shown when the player has no tips left.
 * @returns {{ tips: number; usdc: string; recipient: string | null; available: boolean }}
 */
export function getTipPackOffer() {
  const available = isUsdcCreditsConfigured() && TIP_PACK_USDC_UNITS > 0n;
  return {
    tips: TIP_PACK_TIPS,
    usdc: TIP_PACK_USDC,
    recipient: available ? process.env.HOSTED_AGENT_CREDITS_USDC_RECIPIENT || null : null,
    available,
  };
}

function allowanceFromRow(row) {
  if (!row) return TIPS_PER_GAME;
  const a = Number(row.tip_allowance);
  return Number.isFinite(a) && a > 0 ? a : TIPS_PER_GAME;
}

/**
 * @param {number} gameId
 * @param {number} userId
 * @returns {Promise<{ used: number; remaining: number; limit: number; allowed: boolean }>}
 */
export async function getTipQuota(gameId, userId) {
  if (!gameId || !userId || TIPS_PER_GAME <= 0) {
    return { used: 0, remaining: TIPS_PER_GAME, limit: TIPS_PER_GAME, allowed: TIPS_PER_GAME > 0 };
  }
  const row = await db("game_ai_tip_usage").where({ game_id: gameId, user_id: userId }).first();
  const used = row ? Number(row.tip_count) || 0 : 0;
  const limit = allowanceFromRow(row);
  const remaining = Math.max(0, limit - used);
  return { used, remaining, limit, allowed: remaining > 0 };
}

/**
 * Ensure usage row exists with base free allowance.
 */
async function ensureUsageRow(gameId, userId) {
  const existing = await db("game_ai_tip_usage").where({ game_id: gameId, user_id: userId }).first();
  if (existing) return existing;
  try {
    await db("game_ai_tip_usage").insert({
      game_id: gameId,
      user_id: userId,
      tip_count: 0,
      tip_allowance: TIPS_PER_GAME,
    });
  } catch {
    // race: row created by another request
  }
  return db("game_ai_tip_usage").where({ game_id: gameId, user_id: userId }).first();
}

/**
 * Atomically consume one tip if under the player's current allowance.
 * @returns {Promise<{ ok: boolean; used: number; remaining: number; limit: number }>}
 */
export async function tryConsumeTip(gameId, userId) {
  if (!gameId || !userId || TIPS_PER_GAME <= 0) {
    return { ok: false, used: 0, remaining: 0, limit: TIPS_PER_GAME };
  }

  await ensureUsageRow(gameId, userId);

  const updated = await db("game_ai_tip_usage")
    .where({ game_id: gameId, user_id: userId })
    .whereRaw("tip_count < tip_allowance")
    .update({ tip_count: db.raw("tip_count + 1"), updated_at: db.fn.now() });

  if (!updated) {
    const row = await db("game_ai_tip_usage").where({ game_id: gameId, user_id: userId }).first();
    const used = row ? Number(row.tip_count) || 0 : 0;
    const limit = allowanceFromRow(row);
    return { ok: false, used, remaining: 0, limit };
  }

  const row = await db("game_ai_tip_usage").where({ game_id: gameId, user_id: userId }).first();
  const used = row ? Number(row.tip_count) || 1 : 1;
  const limit = allowanceFromRow(row);
  return { ok: true, used, remaining: Math.max(0, limit - used), limit };
}

/**
 * Grant a tip pack (+TIP_PACK_TIPS) for this game. Idempotent via caller storing tx_hash.
 * @returns {Promise<{ tip_allowance: number; tips_granted: number }>}
 */
export async function grantTipPack(gameId, userId) {
  if (!gameId || !userId) {
    throw new Error("gameId and userId required");
  }
  await ensureUsageRow(gameId, userId);
  await db("game_ai_tip_usage")
    .where({ game_id: gameId, user_id: userId })
    .update({
      tip_allowance: db.raw("tip_allowance + ?", [TIP_PACK_TIPS]),
      updated_at: db.fn.now(),
    });
  const row = await db("game_ai_tip_usage").where({ game_id: gameId, user_id: userId }).first();
  return { tip_allowance: allowanceFromRow(row), tips_granted: TIP_PACK_TIPS };
}
