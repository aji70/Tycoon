import db from "../config/database.js";
import redis from "../config/redis.js";
import User from "../models/User.js";
import logger from "../config/logger.js";
import { parseYearMonth } from "../utils/leaderboardMonth.js";
import {
  FEATURED_BOUNTY_MONTH_KEY,
  listBountyMonths,
  bountyMonthToLeaderboardQuery,
} from "../config/bountyMonths.js";

/** Set LEADERBOARD_DAILY_SNAPSHOT=false to serve live rankings (legacy). Default: daily snapshots. */
export function isDailySnapshotEnabled() {
  return process.env.LEADERBOARD_DAILY_SNAPSHOT !== "false";
}

const SNAPSHOT_CHAINS = (process.env.LEADERBOARD_SNAPSHOT_CHAINS || "CELO,BASE,POLYGON")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

const BOUNTY_MONTH = process.env.LEADERBOARD_BOUNTY_MONTH || FEATURED_BOUNTY_MONTH_KEY;

/** Unlimited snapshot size — all players with finished games (safety cap via LEADERBOARD_MAX_ROWS in User model). */
const SNAPSHOT_LIMIT = 0;

function isUnlimitedLimit(limit) {
  if (limit === "all" || limit === 0 || limit === "0") return true;
  const n = Number.parseInt(limit, 10);
  return !Number.isFinite(n) || n <= 0;
}

function clientResultLimit(limit) {
  if (isUnlimitedLimit(limit)) return null;
  const n = Number.parseInt(limit, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function utcDateString(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function buildCacheKey({ chain, type, period, month, start, end }) {
  const periodNorm = period === "month" ? "month" : period === "range" ? "range" : "all";
  const parts = [User.normalizeChain(chain), String(type).toLowerCase(), periodNorm];
  if (periodNorm === "month" && month) parts.push(parseYearMonth(month));
  if (periodNorm === "range" && start && end) {
    parts.push(String(start), String(end));
  }
  return parts.join("|");
}

/**
 * Compute leaderboard rows (same logic as GET /users/leaderboard).
 */
export async function computeLeaderboard(query) {
  const { chain = "CELO", type = "wins", limit = SNAPSHOT_LIMIT, period = "all", month, start, end } = query;
  const normalizedType = String(type).toLowerCase();
  const rawPeriod = String(period).toLowerCase();
  const periodNorm = rawPeriod === "month" ? "month" : rawPeriod === "range" ? "range" : "all";

  if (periodNorm === "range") {
    if (normalizedType !== "played") {
      const err = new Error("Range leaderboard currently supports type=played only.");
      err.code = "range_not_supported";
      throw err;
    }
    if (!start || !end) {
      const err = new Error("Provide start and end ISO timestamps for period=range.");
      err.code = "missing_range_params";
      throw err;
    }
    return User.getRangeLeaderboardByGamesPlayed(chain, String(start), String(end), limit);
  }

  if (periodNorm === "month") {
    switch (normalizedType) {
      case "wins":
        return User.getMonthlyLeaderboardByWins(chain, month, limit);
      case "winrate":
        return User.getMonthlyLeaderboardByWinRate(chain, month, limit);
      case "played":
        return User.getMonthlyLeaderboardByGamesPlayed(chain, month, limit);
      case "earnings":
      case "stakes": {
        const err = new Error(
          "Monthly leaderboard is available for wins, win rate, and games played. Earnings/stakes are all-time totals."
        );
        err.code = "monthly_not_supported";
        throw err;
      }
      default: {
        const err = new Error("Invalid type. Use: wins, earnings, stakes, winrate, played");
        err.code = "invalid_type";
        throw err;
      }
    }
  }

  switch (normalizedType) {
    case "wins":
      return User.getLeaderboardByWins(chain, limit);
    case "earnings":
      return User.getLeaderboardByEarnings(chain, limit);
    case "stakes":
      return User.getLeaderboardByStakes(chain, limit);
    case "winrate":
      return User.getLeaderboardByWinRate(chain, limit);
    case "played":
      return User.getAllTimeLeaderboardByGamesPlayed(chain, limit);
    default: {
      const err = new Error("Invalid type. Use: wins, earnings, stakes, winrate, played");
      err.code = "invalid_type";
      throw err;
    }
  }
}

/** Redis front-cache for snapshot rows (they only change on daily refresh). */
const SNAPSHOT_REDIS_TTL = Number(process.env.LEADERBOARD_SNAPSHOT_REDIS_TTL_SECONDS) || 300;
const SNAPSHOT_REDIS_PREFIX = "lb:snap:";

export async function saveSnapshot(cacheKey, snapshotDate, data) {
  const payload = JSON.stringify(data);
  const updatedAt = new Date();
  await db("leaderboard_snapshots")
    .insert({
      cache_key: cacheKey,
      snapshot_date: snapshotDate,
      payload,
      updated_at: updatedAt,
    })
    .onConflict(["cache_key", "snapshot_date"])
    .merge({ payload, updated_at: updatedAt });
  await redis.del(SNAPSHOT_REDIS_PREFIX + cacheKey);
  return updatedAt;
}

async function serveLiveLeaderboard(query, clientLim) {
  const data = await computeLeaderboard(query);
  const rows = Array.isArray(data) ? data : [];
  const today = utcDateString();
  return {
    data: clientLim == null ? rows : rows.slice(0, clientLim),
    lastUpdatedAt: new Date().toISOString(),
    snapshotDate: today,
    live: true,
  };
}

export async function loadLatestSnapshot(cacheKey, preferDate = utcDateString()) {
  const redisKey = SNAPSHOT_REDIS_PREFIX + cacheKey;
  // saveSnapshot invalidates this key, so a hit is always the latest saved snapshot.
  const cached = await redis.getJSON(redisKey);
  if (cached && Array.isArray(cached.data)) {
    return cached;
  }

  let row = await db("leaderboard_snapshots")
    .where({ cache_key: cacheKey, snapshot_date: preferDate })
    .first();

  if (!row) {
    row = await db("leaderboard_snapshots")
      .where({ cache_key: cacheKey })
      .orderBy("snapshot_date", "desc")
      .first();
  }

  if (!row) return null;

  let data;
  try {
    data = JSON.parse(row.payload);
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;

  const result = {
    data,
    lastUpdatedAt: row.updated_at,
    snapshotDate: row.snapshot_date,
  };
  await redis.setJSON(redisKey, result, SNAPSHOT_REDIS_TTL);
  return result;
}

export function snapshotQueriesForRefresh() {
  const currentMonth = parseYearMonth();
  const monthKeys = new Set([currentMonth, BOUNTY_MONTH]);
  for (const bounty of listBountyMonths()) {
    if (bounty.period === "month" && bounty.month) {
      monthKeys.add(bounty.month);
    }
  }

  const queries = [];

  for (const chain of SNAPSHOT_CHAINS) {
    queries.push({ chain, type: "played", period: "all", limit: SNAPSHOT_LIMIT });
    for (const month of monthKeys) {
      queries.push({ chain, type: "played", period: "month", month, limit: SNAPSHOT_LIMIT });
    }
    for (const bounty of listBountyMonths()) {
      if (bounty.period === "range" && bounty.completed) {
        queries.push({
          chain,
          type: "played",
          limit: SNAPSHOT_LIMIT,
          ...bountyMonthToLeaderboardQuery(bounty),
        });
      }
    }
  }

  return queries;
}

export async function refreshAllSnapshots() {
  const snapshotDate = utcDateString();
  logger.info({ snapshotDate }, "Refreshing leaderboard snapshots");
  const queries = snapshotQueriesForRefresh();
  let ok = 0;
  let fail = 0;

  for (const q of queries) {
    try {
      const key = buildCacheKey(q);
      const data = await computeLeaderboard(q);
      await saveSnapshot(key, snapshotDate, data);
      ok += 1;
    } catch (err) {
      fail += 1;
      logger.warn({ err: err?.message, query: q }, "Leaderboard snapshot refresh failed");
    }
  }

  logger.info({ snapshotDate, ok, fail }, "Leaderboard snapshots refreshed");
  return { snapshotDate, ok, fail };
}

/**
 * Serve cached daily snapshot (anti-farming). Range queries stay live.
 */
export async function getLeaderboardWithSnapshot(query) {
  const periodNorm = String(query.period || "all").toLowerCase();
  const clientLim = clientResultLimit(query.limit);

  if (!isDailySnapshotEnabled() || periodNorm === "range") {
    return serveLiveLeaderboard(query, clientLim);
  }

  const key = buildCacheKey({ ...query, period: periodNorm });
  const today = utcDateString();
  let cached = await loadLatestSnapshot(key, today);

  if (!cached) {
    const anyRow = await db("leaderboard_snapshots").where({ cache_key: key }).first();
    if (!anyRow) {
      logger.info({ cacheKey: key }, "Bootstrapping first leaderboard snapshot");
      const data = await computeLeaderboard({ ...query, limit: SNAPSHOT_LIMIT });
      try {
        const updatedAt = await saveSnapshot(key, today, data);
        cached = {
          data: Array.isArray(data) ? data : [],
          lastUpdatedAt: updatedAt,
          snapshotDate: today,
        };
      } catch (saveErr) {
        logger.warn(
          { err: saveErr?.message, code: saveErr?.code, cacheKey: key },
          "Snapshot bootstrap failed; serving live leaderboard"
        );
        return serveLiveLeaderboard({ ...query, limit: query.limit ?? SNAPSHOT_LIMIT }, clientLim);
      }
    }
  }

  if (!cached) {
    logger.info({ cacheKey: key }, "No snapshot available; serving live leaderboard");
    return serveLiveLeaderboard(query, clientLim);
  }

  return {
    data: clientLim == null ? cached.data : cached.data.slice(0, clientLim),
    lastUpdatedAt: new Date(cached.lastUpdatedAt).toISOString(),
    snapshotDate: cached.snapshotDate,
    live: false,
    stale: cached.snapshotDate !== today,
  };
}
