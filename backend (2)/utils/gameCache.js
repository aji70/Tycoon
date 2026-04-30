/**
 * Redis cache for game-by-code payloads (Step 8). TTL 60s; invalidate on update.
 */
import redis from "../config/redis.js";
import Game from "../models/Game.js";

const TTL = 60; // seconds
const PREFIX = "game:code:";

export async function getCachedGameByCode(code) {
  const raw = await redis.get(PREFIX + code);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setCachedGameByCode(code, data) {
  await redis.setex(PREFIX + code, TTL, JSON.stringify(data));
}

export async function invalidateGameByCode(code) {
  await redis.del(PREFIX + code);
}

export async function invalidateGameById(gameId) {
  try {
    const game = await Game.findById(gameId);
    if (game?.code) await invalidateGameByCode(game.code);
  } catch (_) {}
}
