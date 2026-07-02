import logger from "../config/logger.js";
import { loadOverviewMetrics } from "./adminDashboardController.js";
import { getContractTxStats } from "../services/contractTxStats.js";

/**
 * GET /api/public/stats
 * Query: period=all|day|week|month
 */
export async function getPublicStats(req, res) {
  try {
    const { metrics, period } = await loadOverviewMetrics(req.query.period);
    const contractStats = await getContractTxStats({ period });

    res.json({
      success: true,
      data: {
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
      },
    });
  } catch (err) {
    logger.error({ err }, "public stats error");
    res.status(500).json({ success: false, error: "Failed to load public stats" });
  }
}
