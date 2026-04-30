/**
 * Per-user daily usage cap for Tycoon-hosted agent decisions.
 * Set HOSTED_AGENT_DAILY_CAP (default 100) to limit API billing per user per day.
 */

import db from "../config/database.js";

const CAP = Math.max(0, Number(process.env.HOSTED_AGENT_DAILY_CAP) || 100);

function todayUtc() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/**
 * Get today's usage count for a user.
 * @param {number} userId
 * @returns {Promise<number>}
 */
export async function getTodayUsage(userId) {
  if (!userId) return 0;
  const row = await db("hosted_agent_usage")
    .where({ user_id: userId, usage_date: todayUtc() })
    .select("count")
    .first();
  return row ? Number(row.count) || 0 : 0;
}

/**
 * Increment today's usage by 1. Call only after checking isUnderCap.
 * @param {number} userId
 */
export async function incrementUsage(userId) {
  if (!userId) return;
  const date = todayUtc();
  const existing = await db("hosted_agent_usage")
    .where({ user_id: userId, usage_date: date })
    .first();
  if (existing) {
    await db("hosted_agent_usage")
      .where({ user_id: userId, usage_date: date })
      .increment("count", 1);
  } else {
    await db("hosted_agent_usage").insert({
      user_id: userId,
      usage_date: date,
      count: 1,
    });
  }
}

/**
 * Whether the user is under the daily cap and can consume one more decision.
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
export async function isUnderCap(userId) {
  const used = await getTodayUsage(userId);
  return used < CAP;
}

/**
 * Get remaining credits for today (for UI).
 * @param {number} userId
 * @returns {Promise<{ used: number, cap: number, remaining: number }>}
 */
export async function getCredits(userId) {
  const used = await getTodayUsage(userId);
  return { used, cap: CAP, remaining: Math.max(0, CAP - used) };
}

export { CAP as HOSTED_AGENT_DAILY_CAP };
