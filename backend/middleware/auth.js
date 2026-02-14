/**
 * Optional auth middleware: if Bearer token present, verify JWT and set req.user.
 * Used for guest create/join; does not block if no token.
 */
import jwt from "jsonwebtoken";
import User from "../models/User.js";

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
    req.user = user;
    req.isGuest = !!decoded.isGuest;
    next();
  } catch (_) {
    next();
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
    req.user = user;
    req.isGuest = !!decoded.isGuest;
    next();
  } catch (_) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}
