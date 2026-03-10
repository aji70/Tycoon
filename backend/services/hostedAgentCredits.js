/**
 * Purchasable hosted agent credits.
 * Pricing: $1 USDC = 100 credits, 1000 NGN = 100 credits.
 * Each Tycoon-hosted AI decision costs 1 credit.
 */

import db from "../config/database.js";

export const CREDITS_PER_USDC = 100;
export const USDC_PRICE_WEI = 1_000_000n; // 1 USDC (6 decimals)
export const CREDITS_FOR_1_USDC = 100;

export const CREDITS_PER_1000_NGN = 100;
export const NGN_PRICE_PER_100_CREDITS = 1000;

/**
 * Ensure user has a row in hosted_agent_credits. Return or create.
 */
async function getOrCreateRow(userId) {
  const row = await db("hosted_agent_credits").where({ user_id: userId }).first();
  if (row) return row;
  await db("hosted_agent_credits").insert({
    user_id: userId,
    balance: 0,
  });
  return db("hosted_agent_credits").where({ user_id: userId }).first();
}

/**
 * Get current balance for a user.
 * @param {number} userId
 * @returns {Promise<number>}
 */
export async function getBalance(userId) {
  if (!userId) return 0;
  const row = await db("hosted_agent_credits").where({ user_id: userId }).first();
  return row ? Number(row.balance) || 0 : 0;
}

/**
 * Whether the user has at least one credit to consume.
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
export async function hasCredits(userId) {
  const bal = await getBalance(userId);
  return bal > 0;
}

/**
 * Deduct one credit for a decision. Call only after hasCredits.
 * @param {number} userId
 * @returns {Promise<boolean>} true if deducted, false if not enough
 */
export async function deductCredit(userId) {
  if (!userId) return false;
  const row = await getOrCreateRow(userId);
  const current = Number(row.balance) || 0;
  if (current < 1) return false;
  await db("hosted_agent_credits")
    .where({ user_id: userId })
    .update({ balance: current - 1, updated_at: db.fn.now() });
  return true;
}

/**
 * Add credits (after purchase).
 * @param {number} userId
 * @param {number} credits
 * @param {object} purchase - { source, price_usdc?, price_ngn?, tx_hash?, tx_ref? }
 * @returns {Promise<{ balance: number }>}
 */
export async function addCredits(userId, credits, purchase = {}) {
  if (!userId || credits < 1) throw new Error("Invalid addCredits call");
  const row = await getOrCreateRow(userId);
  const current = Number(row.balance) || 0;
  const newBalance = current + credits;
  await db("hosted_agent_credits")
    .where({ user_id: userId })
    .update({ balance: newBalance, updated_at: db.fn.now() });

  await db("hosted_agent_credit_purchases").insert({
    user_id: userId,
    credits,
    price_usdc: purchase.price_usdc ?? null,
    price_ngn: purchase.price_ngn ?? null,
    source: purchase.source || "unknown",
    tx_hash: purchase.tx_hash ?? null,
    tx_ref: purchase.tx_ref ?? null,
  });

  return { balance: newBalance };
}
