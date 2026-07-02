import logger from "../config/logger.js";
import { getContractTxStats } from "../services/contractTxStats.js";

/**
 * GET /api/admin/contracts/tx-stats
 * Query: refresh=true to bypass cache, period=all|day|week|month
 */
export async function getTxStats(req, res) {
  try {
    const refresh = req.query.refresh === "true" || req.query.refresh === "1";
    const rawPeriod = String(req.query.period || "all").toLowerCase();
    const period =
      rawPeriod === "day" || rawPeriod === "week" || rawPeriod === "month"
        ? rawPeriod
        : "all";
    const data = await getContractTxStats({ refresh, period });
    res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, "admin getContractTxStats error");
    res.status(500).json({ success: false, error: "Failed to load contract transaction stats" });
  }
}
