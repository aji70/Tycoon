/**
 * Update user property/trade stats and property purchase log.
 * Used for: properties bought/sold, trades initiated/accepted, favourite property.
 */
import db from "../config/database.js";

/**
 * Record a property purchase (from bank or trade) and increment properties_bought.
 * @param {number} userId - User ID
 * @param {number} propertyId - Property ID (1-40)
 * @param {number} gameId - Game ID
 * @param {'bank'|'trade'} source
 */
export async function recordPropertyPurchase(userId, propertyId, gameId, source) {
  if (!userId || !propertyId || !gameId) return;
  await db("user_property_purchases").insert({
    user_id: userId,
    property_id: propertyId,
    game_id: gameId,
    source,
  });
  await db("users").where({ id: userId }).increment("properties_bought", 1);
}

/**
 * Increment properties_sold for a user.
 */
export async function incrementPropertiesSold(userId) {
  if (!userId) return;
  await db("users").where({ id: userId }).increment("properties_sold", 1);
}

/**
 * Increment trades_initiated for a user.
 */
export async function incrementTradesInitiated(userId) {
  if (!userId) return;
  await db("users").where({ id: userId }).increment("trades_initiated", 1);
}

/**
 * Increment trades_accepted for a user.
 */
export async function incrementTradesAccepted(userId) {
  if (!userId) return;
  await db("users").where({ id: userId }).increment("trades_accepted", 1);
}

/**
 * Get user's favourite property (property_id bought most often).
 * @param {number} userId
 * @returns {{ property_id: number, count: number } | null}
 */
export async function getFavouriteProperty(userId) {
  const row = await db("user_property_purchases")
    .where({ user_id: userId })
    .select("property_id")
    .count("* as count")
    .groupBy("property_id")
    .orderBy("count", "desc")
    .first();
  if (!row) return null;
  return { property_id: Number(row.property_id), count: Number(row.count) };
}

/**
 * Get user property stats.
 */
export async function getUserPropertyStats(userId) {
  const user = await db("users")
    .where({ id: userId })
    .select("properties_bought", "properties_sold", "trades_initiated", "trades_accepted")
    .first();
  if (!user) return null;
  const favourite = await getFavouriteProperty(userId);
  return {
    properties_bought: Number(user.properties_bought ?? 0),
    properties_sold: Number(user.properties_sold ?? 0),
    trades_initiated: Number(user.trades_initiated ?? 0),
    trades_accepted: Number(user.trades_accepted ?? 0),
    favourite_property: favourite,
  };
}
