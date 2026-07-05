import logger from "../config/logger.js";
import { getDashboard, getRecentActivity, getActiveUsersSeries, getNewUsersSeries, getRetentionCohorts } from "../services/analytics.js";

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

/**
 * GET /api/admin/analytics/active-users
 * Query: period = daily | weekly | monthly
 */
export async function activeUsers(req, res) {
  try {
    const raw = String(req.query.period || "daily").toLowerCase();
    const period = raw === "weekly" || raw === "monthly" ? raw : "daily";
    const data = await getActiveUsersSeries(period);
    res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, "admin analytics activeUsers error");
    res.status(500).json({ success: false, error: "Failed to load active users series" });
  }
}

/**
 * GET /api/admin/analytics/new-users
 * Query: period = daily | weekly | monthly
 */
export async function newUsers(req, res) {
  try {
    const raw = String(req.query.period || "daily").toLowerCase();
    const period = raw === "weekly" || raw === "monthly" ? raw : "daily";
    const data = await getNewUsersSeries(period);
    res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, "admin analytics newUsers error");
    res.status(500).json({ success: false, error: "Failed to load new users series" });
  }
}

/**
 * GET /api/admin/analytics/retention
 * Query: startDate, endDate (ISO dates), or days (default 30) for cohort window.
 */
export async function retention(req, res) {
  try {
    const { startDate, endDate, days, debug } = req.query;
    const options = {};
    if (startDate) options.startDate = String(startDate);
    if (endDate) options.endDate = String(endDate);
    if (days != null && String(days).trim() !== "") options.days = Number(days);
    if (debug === "1" || debug === "true") options.debug = true;
    const data = await getRetentionCohorts(options);
    res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, "admin analytics retention error");
    res.status(500).json({ success: false, error: "Failed to load retention cohorts" });
  }
}
