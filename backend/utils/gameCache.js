/**
 * Redis cache for game-by-code payloads. TTL 60s; invalidate on update.
 *
 * A side mapping (game id -> code) is kept in Redis so invalidateGameById
 * does not need a DB read on every game mutation. The mapping outlives the
 * payload key, so a missing mapping normally means there is nothing cached;
 * we still fall back to a DB lookup in that case to stay correct under
 * Redis evictions.
 */
import redis from "../config/redis.js";
import Game from "../models/Game.js";

const TTL = Number(process.env.GAME_CACHE_TTL_SECONDS) || 60; // seconds
const ID_MAP_TTL = 60 * 60; // 1h; must stay >= TTL
const PREFIX = "game:code:";
const ID_PREFIX = "game:id2code:";

export async function getCachedGameByCode(code) {
  return redis.getJSON(PREFIX + code);
}

export async function setCachedGameByCode(code, data) {
  await Promise.all([
    redis.setex(PREFIX + code, TTL, JSON.stringify(data)),
    data?.id != null ? redis.setex(ID_PREFIX + data.id, ID_MAP_TTL, String(code)) : Promise.resolve(),
  ]);
}

export async function invalidateGameByCode(code) {
  await redis.del(PREFIX + code);
}

/** Resolve a game's code from its id via Redis mapping, falling back to the DB. */
export async function getGameCodeById(gameId) {
  let code = await redis.get(ID_PREFIX + gameId);
  if (!code) {
    const game = await Game.findById(gameId);
    code = game?.code || null;
    if (code) await redis.setex(ID_PREFIX + gameId, ID_MAP_TTL, String(code));
  }
  return code;
}

export async function invalidateGameById(gameId) {
  try {
    const code = await getGameCodeById(gameId);
    if (code) await invalidateGameByCode(code);
  } catch (_) {}
}
