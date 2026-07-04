import logger from "../config/logger.js";
import redis from "../config/redis.js";
import { loadOverviewMetrics } from "./adminDashboardController.js";
import { getContractTxStats } from "../services/contractTxStats.js";

const CACHE_TTL_SECONDS = Number(process.env.PUBLIC_STATS_CACHE_TTL_SECONDS) || 120;

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
    };

    await redis.setJSON(cacheKey, data, CACHE_TTL_SECONDS);

    res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, "public stats error");
    res.status(500).json({ success: false, error: "Failed to load public stats" });
  }
}
