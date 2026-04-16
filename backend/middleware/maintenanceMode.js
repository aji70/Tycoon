import { isMaintenanceModeEnabled } from "../services/platformSettings.js";

/**
 * Blocks most /api traffic when maintenance mode is on (DB flag).
 * Always allows: /health, /api/admin/*, /api/auth/*, Flutterwave webhook path.
 */
export async function blockApiWhenMaintenance(req, res, next) {
  const path = (req.originalUrl || req.url || "").split("?")[0];

  if (path === "/health" || path.startsWith("/health/")) {
    return next();
  }
  if (path.startsWith("/api/admin")) {
    return next();
  }
  if (path.startsWith("/api/auth")) {
    return next();
  }
  if (path === "/api/shop/flutterwave/webhook") {
    return next();
  }

  try {
    const on = await isMaintenanceModeEnabled();
    if (!on) return next();
    return res.status(503).json({
      success: false,
      error: "maintenance_mode",
      message: "Service temporarily unavailable for maintenance.",
    });
  } catch {
    return next();
  }
}
