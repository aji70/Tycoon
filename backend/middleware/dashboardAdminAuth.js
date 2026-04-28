import jwt from "jsonwebtoken";

const ADMIN_JWT_TTL = "12h";

function getAdminJwtSecret() {
  return process.env.TYCOON_ADMIN_JWT_SECRET || process.env.JWT_SECRET || "tycoon-admin-secret-change-in-production";
}

function getConfiguredAdminCredentials() {
  const username = process.env.TYCOON_ADMIN_USERNAME?.trim();
  const password = process.env.TYCOON_ADMIN_PASSWORD?.trim();
  return {
    username: username || "",
    password: password || "",
    enabled: Boolean(username && password),
  };
}

export function postDashboardAdminLogin(req, res) {
  const { username: expectedUser, password: expectedPass, enabled } = getConfiguredAdminCredentials();
  if (!enabled) {
    return res.status(503).json({
      success: false,
      error: "Admin username/password is not configured on the backend",
    });
  }

  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "").trim();
  if (!username || !password || username !== expectedUser || password !== expectedPass) {
    return res.status(401).json({
      success: false,
      error: "Invalid admin username or password",
    });
  }

  const token = jwt.sign({ scope: "admin", username }, getAdminJwtSecret(), { expiresIn: ADMIN_JWT_TTL });
  return res.json({
    success: true,
    data: { token, expiresIn: ADMIN_JWT_TTL },
  });
}

/**
 * Guards /api/admin/* routes.
 * Preferred auth: Bearer admin JWT from /api/admin/auth/login.
 * Backward-compatible fallback: TYCOON_ADMIN_SECRET header.
 */
export function requireDashboardAdminSecret(req, res, next) {
  const auth = req.get("authorization") || "";
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() === "bearer" && token) {
    try {
      const decoded = jwt.verify(token, getAdminJwtSecret());
      if (decoded && typeof decoded === "object" && decoded.scope === "admin") {
        req.admin = decoded;
        return next();
      }
    } catch {
      // fall through to legacy secret check for compatibility
    }
  }

  const legacySecret = process.env.TYCOON_ADMIN_SECRET?.trim();
  if (legacySecret) {
    const provided = req.get("x-tycoon-admin-secret") || req.get("X-Tycoon-Admin-Secret");
    if (provided === legacySecret) return next();
  }

  return res.status(401).json({
    success: false,
    error: "Unauthorized admin access",
  });
}
