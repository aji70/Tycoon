import express from "express";
import { getDashboard, getRecentActivity } from "../services/analytics.js";
import logger from "../config/logger.js";

const router = express.Router();
const ANALYTICS_API_KEY = process.env.ANALYTICS_API_KEY;

function requireAnalyticsAuth(req, res, next) {
  if (!ANALYTICS_API_KEY) return next();
  const key = req.get("X-Analytics-Key") || req.query?.key;
  if (key === ANALYTICS_API_KEY) return next();
  res.status(401).json({ success: false, error: "Unauthorized" });
}

/**
 * GET /api/analytics/dashboard
 * Returns aggregated stats for admin/feedback dashboards.
 * Query: startDate, endDate (ISO date), key (if ANALYTICS_API_KEY set).
 * Protected by ANALYTICS_API_KEY when set.
 */
router.get("/dashboard", requireAnalyticsAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const options = [startDate, endDate].some(Boolean) ? { startDate, endDate } : {};
    const data = await getDashboard(options);
    res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, "Analytics dashboard error");
    res.status(500).json({ success: false, error: "Failed to load dashboard" });
  }
});

/**
 * GET /api/analytics/activity
 * Recent events and optional errors for "recent activity" tab.
 * Protected by ANALYTICS_API_KEY when set.
 */
router.get("/activity", requireAnalyticsAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query?.limit) || 50, 200);
    const data = await getRecentActivity(limit);
    res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, "Analytics activity error");
    res.status(500).json({ success: false, error: "Failed to load activity" });
  }
});

export default router;
