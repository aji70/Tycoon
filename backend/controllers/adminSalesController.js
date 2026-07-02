import logger from "../config/logger.js";
import { getRewardSalesStats } from "../services/rewardSalesStats.js";

export async function getRewardSales(req, res) {
  try {
    const refresh = req.query.refresh === "true" || req.query.refresh === "1";
    const period = String(req.query.period || "all").toLowerCase();
    const chain = String(req.query.chain || "CELO").toUpperCase();
    const data = await getRewardSalesStats({ refresh, period, chain });
    res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, "admin reward sales error");
    res.status(500).json({ success: false, error: "Failed to load reward sales stats" });
  }
}
