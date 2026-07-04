/**
 * Short-TTL Redis cache for auth-time user lookups.
 *
 * Auth middleware resolves the JWT's user on every request; caching that row
 * for a few seconds removes the single most frequent DB read in the API.
 * TTL is short (default 30s) so account_status changes (ban/suspend) and
 * profile updates propagate quickly even when an invalidation is missed.
 * User.update / User.delete invalidate explicitly.
 */
import redis from "../config/redis.js";
import db from "../config/database.js";

const TTL = Number(process.env.USER_AUTH_CACHE_TTL_SECONDS) || 30;
const PREFIX = "user:auth:";

export async function getUserByIdCached(id) {
  if (id == null) return null;
  const key = PREFIX + id;
  const cached = await redis.getJSON(key);
  if (cached) return cached;
  const user = await db("users").where({ id }).first();
  if (user) await redis.setJSON(key, user, TTL);
  return user || null;
}

export async function invalidateUserCache(id) {
  if (id == null) return;
  await redis.del(PREFIX + id);
}
