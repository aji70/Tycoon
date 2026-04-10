import logger from "../config/logger.js";
import { getDashboard, getRecentActivity } from "../services/analytics.js";

/**
 * GET /api/admin/analytics/dashboard
 * Query: startDate, endDate (ISO date strings) — passed to getDashboard.
 */
export async function dashboard(req, res) {
  try {
    const { startDate, endDate } = req.query;
    const options = [startDate, endDate].some(Boolean) ? { startDate, endDate } : {};
    const data = await getDashboard(options);
    res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, "admin analytics dashboard error");
    res.status(500).json({ success: false, error: "Failed to load analytics dashboard" });
  }
}

/**
 * GET /api/admin/analytics/activity
 * Query: limit (1–200)
 */
export async function activity(req, res) {
  try {
    const limit = Math.min(Number(req.query?.limit) || 80, 200);
    const data = await getRecentActivity(limit);
    res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, "admin analytics activity error");
    res.status(500).json({ success: false, error: "Failed to load activity" });
  }
}
