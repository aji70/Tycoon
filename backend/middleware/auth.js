/**
 * Optional auth middleware: if Bearer token present, verify JWT and set req.user.
 * Used for guest create/join; does not block if no token.
 */
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { ensureUserForWallet } from "../services/walletUserService.js";

const JWT_SECRET = process.env.JWT_SECRET || "tycoon-guest-secret-change-in-production";

export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.userId) return next();
    const user = await User.findById(decoded.userId);
    if (!user) return next();
    const st = String(user.account_status || "active").toLowerCase();
    if (st === "banned" || st === "suspended") {
      return res.status(403).json({
        success: false,
        code: st === "banned" ? "ACCOUNT_BANNED" : "ACCOUNT_SUSPENDED",
        message: st === "banned" ? "This account has been banned." : "This account is suspended.",
      });
    }
    req.user = user;
    req.userId = decoded.userId;
    req.isGuest = !!decoded.isGuest;
    next();
  } catch (_) {
    next();
  }
}

/**
 * Auth or address: accepts JWT token OR wallet address in body.
 * Used for no-gas fallback game create/join from MiniPay wallets.
 * If JWT present, behaves like requireAuth.
 * If no JWT but address in body, resolves user by address and sets req.user.
 */
export async function requireAuthOrAddress(req, res, next) {
  const authHeader = req.headers.authorization;

  // JWT path
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded.userId) return res.status(401).json({ success: false, message: "Invalid token" });
      const user = await User.findById(decoded.userId);
      if (!user) return res.status(401).json({ success: false, message: "User not found" });
      const st = String(user.account_status || "active").toLowerCase();
      if (st === "banned" || st === "suspended") {
        return res.status(403).json({ success: false, message: st === "banned" ? "This account has been banned." : "This account is suspended." });
      }
      req.user = user;
      req.userId = decoded.userId;
      req.isGuest = !!decoded.isGuest;
      return next();
    } catch (_) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
  }

  // Address fallback path
  const address = req.body?.address;
  if (address && /^0x[a-fA-F0-9]{40}$/.test(address.trim())) {
    const user = await User.resolveUserByAddress(address.trim(), req.body?.chain || "CELO").catch(() => null);
    if (!user) return res.status(404).json({ success: false, message: "User not found for this address. Register first." });
    const st = String(user.account_status || "active").toLowerCase();
    if (st === "banned" || st === "suspended") {
      return res.status(403).json({ success: false, message: st === "banned" ? "This account has been banned." : "This account is suspended." });
    }
    req.user = user;
    req.userId = user.id;
    req.isGuest = false;
    req.resolvedByAddress = true;
    return next();
  }

  return res.status(401).json({ success: false, message: "Authentication required" });
}

function pickWalletAddress(req) {
  const fromBody = req.body?.address;
  const fromQuery = req.query?.address;
  const raw =
    (typeof fromBody === "string" && fromBody.trim()) ||
    (typeof fromQuery === "string" && fromQuery.trim()) ||
    "";
  if (!raw || !/^0x[a-fA-F0-9]{40}$/.test(raw)) return null;
  return raw;
}

function pickWalletChain(req) {
  const raw = req.body?.chain ?? req.query?.chain ?? "CELO";
  return User.normalizeChain(String(raw));
}

/**
 * JWT or wallet address (query or body). Creates a user row if missing (MiniPay wallet-first).
 */
export async function requireAuthOrWallet(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded.userId) {
        return res.status(401).json({ success: false, message: "Invalid token" });
      }
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({ success: false, message: "User not found" });
      }
      const st = String(user.account_status || "active").toLowerCase();
      if (st === "banned" || st === "suspended") {
        return res.status(403).json({
          success: false,
          message: st === "banned" ? "This account has been banned." : "This account is suspended.",
        });
      }
      req.user = user;
      req.userId = decoded.userId;
      req.isGuest = !!decoded.isGuest;
      return next();
    } catch (_) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
  }

  const address = pickWalletAddress(req);
  if (!address) {
    return res.status(401).json({
      success: false,
      message: "Authentication required (sign in or pass wallet address)",
    });
  }

  try {
    const chain = pickWalletChain(req);
    const user = await ensureUserForWallet(address, chain);
    const st = String(user.account_status || "active").toLowerCase();
    if (st === "banned" || st === "suspended") {
      return res.status(403).json({
        success: false,
        message: st === "banned" ? "This account has been banned." : "This account is suspended.",
      });
    }
    req.user = user;
    req.userId = user.id;
    req.isGuest = !!user.is_guest;
    req.resolvedByWallet = true;
    return next();
  } catch (err) {
    return res.status(400).json({ success: false, message: err?.message || "Invalid wallet address" });
  }
}

/**
 * Require auth: 401 if no valid token or user.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.userId) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    const st = String(user.account_status || "active").toLowerCase();
    if (st === "banned" || st === "suspended") {
      return res.status(403).json({
        success: false,
        code: st === "banned" ? "ACCOUNT_BANNED" : "ACCOUNT_SUSPENDED",
        message: st === "banned" ? "This account has been banned." : "This account is suspended.",
      });
    }
    req.user = user;
    req.userId = decoded.userId;
    req.isGuest = !!decoded.isGuest;
    next();
  } catch (_) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}
