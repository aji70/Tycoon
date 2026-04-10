/**
 * Shared env parsing for /api/admin hardening (rate limit + optional IP allowlist).
 */

export function parseAdminIpAllowlist() {
  const raw = process.env.TYCOON_ADMIN_IP_ALLOWLIST;
  if (raw == null || String(raw).trim() === "") return null;
  const set = new Set(
    String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  return set.size ? set : null;
}

export function clientIpForAdmin(req) {
  const ff = req.headers["x-forwarded-for"];
  if (typeof ff === "string" && ff.trim()) {
    return ff.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "";
}

export function getAdminRateLimitConfig() {
  const windowMs = Math.min(
    24 * 60 * 60 * 1000,
    Math.max(1000, Number(process.env.TYCOON_ADMIN_RATE_LIMIT_WINDOW_MS) || 60 * 1000)
  );
  const maxRequestsPerWindow = Math.min(
    10_000,
    Math.max(1, Number(process.env.TYCOON_ADMIN_RATE_LIMIT_MAX) || 200)
  );
  return { windowMs, maxRequestsPerWindow };
}
