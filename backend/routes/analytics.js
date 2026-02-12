import express from "express";
import { getDashboard } from "../services/analytics.js";
import logger from "../config/logger.js";

const router = express.Router();

/**
 * GET /api/analytics/dashboard
 * Returns aggregated stats for admin/feedback dashboards.
 * TODO: protect with admin auth or API key in production.
 */
router.get("/dashboard", async (req, res) => {
  try {
    const data = await getDashboard();
    res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, "Analytics dashboard error");
    res.status(500).json({ success: false, error: "Failed to load dashboard" });
  }
});

export default router;
