import db from "../config/database.js";
import logger from "../config/logger.js";

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * GET /api/admin/overview
 * Aggregated platform metrics for the admin dashboard (best-effort counts).
 */
export async function getOverview(req, res) {
  try {
    const startToday = startOfUtcDay();

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
      db("games").count("* as c").first(),
      db("games").whereIn("status", ["RUNNING", "IN_PROGRESS"]).count("* as c").first(),
      db("users").sum("total_earned as s").first(),
      db("game_trades").count("* as c").first(),
      db("game_play_history").count("* as c").first(),
      db("game_properties").count("* as c").first(),
    ]);

    const metrics = {
      totalPlayers: Number(totalPlayersRow?.c ?? 0),
      activePlayersToday: Number(activePlayersTodayRow?.c ?? 0),
      totalGames: Number(totalGamesRow?.c ?? 0),
      gamesRunningNow: Number(gamesRunningRow?.c ?? 0),
      totalTokensDistributed: Number(tokensRow?.s ?? 0),
      totalTrades: Number(tradesRow?.c ?? 0),
      totalPlayHistoryEvents: Number(historyRow?.c ?? 0),
      totalPropertiesOwned: Number(propertiesOwnedRow?.c ?? 0),
      flaggedReports: 0,
    };

    res.json({ success: true, data: { metrics } });
  } catch (err) {
    logger.error({ err }, "admin overview error");
    res.status(500).json({ success: false, error: "Failed to load admin overview" });
  }
}
