/**
 * Optional shared secret for /api/admin/* (dashboard).
 * If TYCOON_ADMIN_SECRET is set, require header x-tycoon-admin-secret to match.
 * Pair with NEXT_PUBLIC_TYCOON_ADMIN_SECRET on the frontend (same pattern as shop admin).
 */
export function requireDashboardAdminSecret(req, res, next) {
  const secret = process.env.TYCOON_ADMIN_SECRET;
  if (!secret || String(secret).trim() === "") {
    return next();
  }
  const provided = req.get("x-tycoon-admin-secret") || req.get("X-Tycoon-Admin-Secret");
  if (provided === secret) {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: "Forbidden: invalid or missing x-tycoon-admin-secret",
  });
}
