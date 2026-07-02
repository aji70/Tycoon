import db from "../config/database.js";
import logger from "../config/logger.js";

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function getOverviewPeriodWindow(period) {
  const now = new Date();
  if (period === "day") {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  if (period === "week") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (period === "month") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return null;
}

function normalizeOverviewPeriod(rawPeriod) {
  const period = String(rawPeriod || "all").toLowerCase();
  return period === "day" || period === "week" || period === "month" ? period : "all";
}

export async function loadOverviewMetrics(rawPeriod) {
  const startToday = startOfUtcDay();
  const period = normalizeOverviewPeriod(rawPeriod);
  const periodStart = getOverviewPeriodWindow(period);

  const gamesQuery = db("games");
  const tradesQuery = db("game_trades").where("status", "accepted");
  const historyQuery = db("game_play_history");
  const propertiesOwnedQuery = db("game_properties");

  if (periodStart) {
    gamesQuery.where("created_at", ">=", periodStart);
    tradesQuery.where("updated_at", ">=", periodStart);
    historyQuery.where("created_at", ">=", periodStart);
    propertiesOwnedQuery.where("created_at", ">=", periodStart);
  }

  const [
    totalPlayersRow,
    activePlayersTodayRow,
    totalGamesRow,
    gamesRunningRow,
    tokensRow,
    tradesRow,
    historyRow,
    propertiesOwnedRow,
  ] = await Promise.all([
    db("users").count("* as c").first(),
    db("users").where("updated_at", ">=", startToday).count("* as c").first(),
    gamesQuery.count("* as c").first(),
    db("games").whereIn("status", ["RUNNING", "IN_PROGRESS"]).count("* as c").first(),
    db("users").sum("total_earned as s").first(),
    tradesQuery.count("* as c").first(),
    historyQuery.count("* as c").first(),
    propertiesOwnedQuery.count("* as c").first(),
  ]);

  let flaggedReports = 0;
  try {
    const openReportsRow = await db("moderation_reports").where("status", "open").count("* as c").first();
    flaggedReports = Number(openReportsRow?.c ?? 0);
  } catch (err) {
    logger.warn({ err }, "admin overview: moderation_reports count skipped (table missing?)");
  }

  const metrics = {
    totalPlayers: Number(totalPlayersRow?.c ?? 0),
    activePlayersToday: Number(activePlayersTodayRow?.c ?? 0),
    totalGames: Number(totalGamesRow?.c ?? 0),
    gamesRunningNow: Number(gamesRunningRow?.c ?? 0),
    totalTokensDistributed: Number(tokensRow?.s ?? 0),
    totalTrades: Number(tradesRow?.c ?? 0),
    totalPlayHistoryEvents: Number(historyRow?.c ?? 0),
    totalPropertiesOwned: Number(propertiesOwnedRow?.c ?? 0),
    flaggedReports,
  };

  return { metrics, period };
}

/**
 * GET /api/admin/overview
 * Aggregated platform metrics for the admin dashboard (best-effort counts).
 */
export async function getOverview(req, res) {
  try {
    const { metrics, period } = await loadOverviewMetrics(req.query.period);
    res.json({ success: true, data: { metrics, period } });
  } catch (err) {
    logger.error({ err }, "admin overview error");
    res.status(500).json({ success: false, error: "Failed to load admin overview" });
  }
}
