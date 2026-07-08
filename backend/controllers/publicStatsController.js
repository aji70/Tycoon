import logger from "../config/logger.js";
import redis from "../config/redis.js";
import db from "../config/database.js";
import { loadOverviewMetrics } from "./adminDashboardController.js";
import { getContractTxStats } from "../services/contractTxStats.js";
import { getRewardSalesStats } from "../services/rewardSalesStats.js";

const CACHE_TTL_SECONDS = Number(process.env.PUBLIC_STATS_CACHE_TTL_SECONDS) || 120;

/** Distinct players (by game membership) and games-per-player, plus the single most active player. */
async function loadPlayerEngagement() {
  const [uniqueRow, membershipRow, mostActiveRow] = await Promise.all([
    db("game_players").countDistinct("user_id as c").first(),
    db("game_players").count("* as c").first(),
    db("game_players")
      .select("user_id")
      .count("* as games")
      .whereNotNull("user_id")
      .groupBy("user_id")
      .orderBy("games", "desc")
      .first(),
  ]);

  const uniquePlayers = Number(uniqueRow?.c ?? 0);
  const memberships = Number(membershipRow?.c ?? 0);
  const gamesPerPlayer = uniquePlayers > 0 ? memberships / uniquePlayers : 0;

  let mostActivePlayer = null;
  if (mostActiveRow?.user_id != null) {
    const user = await db("users")
      .where("id", mostActiveRow.user_id)
      .select("username")
      .first();
    mostActivePlayer = {
      username: user?.username ?? null,
      games: Number(mostActiveRow.games ?? 0),
    };
  }

  return {
    uniquePlayers,
    gamesPerPlayer: Math.round(gamesPerPlayer * 10) / 10,
    mostActivePlayer,
  };
}

/** Total USDC volume from perk shop (reward system) purchases. Best-effort — 0 if the chain scan fails. */
async function loadPerkShopRevenueUsdc(period) {
  try {
    const sales = await getRewardSalesStats({ period, chain: "CELO" });
    const usdc = sales?.revenueByCurrency?.USDC?.formatted;
    const value = Number.parseFloat(usdc ?? "0");
    return Number.isFinite(value) ? value : 0;
  } catch (err) {
    logger.warn({ err }, "public stats: perk shop revenue unavailable");
    return null;
  }
}

/** Games created per day for the last 7 UTC days (oldest → newest), zero-filled. */
async function loadDailyGames() {
  const days = 7;
  const now = new Date();
  const startDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)),
  );

  const rows = await db("games")
    .select(db.raw("DATE(created_at) as day"))
    .count("* as count")
    .where("created_at", ">=", startDay)
    .groupByRaw("DATE(created_at)");

  const counts = new Map();
  for (const row of rows) {
    const key =
      row.day instanceof Date
        ? row.day.toISOString().slice(0, 10)
        : String(row.day).slice(0, 10);
    counts.set(key, Number(row.count ?? 0));
  }

  const series = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(startDay.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    series.push({ day: key, count: counts.get(key) ?? 0 });
  }
  return series;
}

/**
 * GET /api/public/stats
 * Query: period=all|day|week|month
 *
 * Heavy aggregate counts — served from Redis (short TTL) so anonymous polling
 * never fans out into full-table COUNT(*) scans on every request.
 */
export async function getPublicStats(req, res) {
  try {
    const periodParam = String(req.query.period || "all").toLowerCase();
    const cacheKey = `public:stats:${periodParam}`;

    const cached = await redis.getJSON(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const { metrics, period } = await loadOverviewMetrics(req.query.period);
    const contractStats = await getContractTxStats({ period });
    const [engagement, perkShopRevenueUsdc, dailyGames] = await Promise.all([
      loadPlayerEngagement(),
      loadPerkShopRevenueUsdc(period),
      loadDailyGames(),
    ]);

    const data = {
      period,
      generatedAt: new Date().toISOString(),
      totals: {
        totalTransactions: contractStats.summary.totalTxns,
        totalTokenTransfers: contractStats.contracts.reduce(
          (sum, row) => sum + (row.tokenTransfers ?? 0),
          0,
        ),
        totalGames: metrics.totalGames,
        totalTrades: metrics.totalTrades,
        totalPlayHistoryEvents: metrics.totalPlayHistoryEvents,
        totalPropertiesOwned: metrics.totalPropertiesOwned,
      },
      engagement: {
        uniquePlayers: engagement.uniquePlayers,
        gamesPerPlayer: engagement.gamesPerPlayer,
        mostActivePlayer: engagement.mostActivePlayer,
        perkShopRevenueUsdc,
      },
      dailyGames,
    };

    await redis.setJSON(cacheKey, data, CACHE_TTL_SECONDS);

    res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, "public stats error");
    res.status(500).json({ success: false, error: "Failed to load public stats" });
  }
}
