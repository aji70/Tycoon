/**
 * Optional shared secret for /api/shop-admin/* (bulk stock, etc.).
 * If SHOP_ADMIN_SECRET is set, require header x-shop-admin-secret to match.
 * Pair with the same value in frontend NEXT_PUBLIC_SHOP_ADMIN_SECRET, or call the API with the header from a trusted client only.
 */
export function requireShopAdminSecret(req, res, next) {
  const secret = process.env.SHOP_ADMIN_SECRET;
  if (!secret || String(secret).trim() === "") {
    return next();
  }
  const provided = req.get("x-shop-admin-secret") || req.get("X-Shop-Admin-Secret");
  if (provided === secret) {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: "Forbidden: invalid or missing x-shop-admin-secret",
  });
}
