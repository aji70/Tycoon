/**
 * Optional hardening for /api/admin/* (after global app limiter).
 * - TYCOON_ADMIN_IP_ALLOWLIST: comma-separated client IPs; if set, other IPs get 403.
 * - TYCOON_ADMIN_RATE_LIMIT_MAX / TYCOON_ADMIN_RATE_LIMIT_WINDOW_MS: per-IP cap on admin routes only.
 */

import rateLimit from "express-rate-limit";
import logger from "../config/logger.js";
import {
  parseAdminIpAllowlist,
  clientIpForAdmin,
  getAdminRateLimitConfig,
} from "../config/adminDashboardSecurity.js";

export { clientIpForAdmin, getAdminRateLimitConfig } from "../config/adminDashboardSecurity.js";

/**
 * If TYCOON_ADMIN_IP_ALLOWLIST is non-empty, only listed IPs may call /api/admin/*.
 */
export function requireAdminIpAllowlist(req, res, next) {
  const allowed = parseAdminIpAllowlist();
  if (!allowed) return next();
  const ip = clientIpForAdmin(req);
  if (allowed.has(ip)) return next();
  logger.warn({ ip }, "admin API blocked: IP not in TYCOON_ADMIN_IP_ALLOWLIST");
  return res.status(403).json({
    success: false,
    error: "Forbidden: IP not allowlisted for admin API",
  });
}

const _adminRl = getAdminRateLimitConfig();

export const adminApiRateLimiter = rateLimit({
  windowMs: _adminRl.windowMs,
  max: _adminRl.maxRequestsPerWindow,
  message: { success: false, error: "Too many admin API requests from this IP; try again shortly." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => clientIpForAdmin(req) || req.ip || "unknown",
});
