/**
 * Guest auth: register (create custodial wallet + on-chain registerPlayerFor) and login.
 * Password is hashed with keccak256 to match contract's expected passwordHash.
 */
import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { registerPlayerFor } from "../services/tycoonContract.js";
import logger from "../config/logger.js";

const JWT_SECRET = process.env.JWT_SECRET || "tycoon-guest-secret-change-in-production";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";

/** Hash password the same way the contract expects (keccak256). */
function passwordToHash(password) {
  return ethers.keccak256(ethers.toUtf8Bytes(password));
}

/**
 * POST /auth/guest-register
 * Body: { username, password }
 * Creates a new wallet, registers on-chain via registerPlayerFor, creates user with is_guest=true.
 */
export async function guestRegister(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || typeof username !== "string" || !password || typeof password !== "string") {
      return res.status(400).json({ success: false, message: "Username and password required" });
    }
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 2) {
      return res.status(400).json({ success: false, message: "Username too short" });
    }

    const existing = await User.findByUsernameIgnoreCase(trimmedUsername);
    if (existing) {
      return res.status(409).json({ success: false, message: "Username already taken" });
    }

    const wallet = ethers.Wallet.createRandom();
    const playerAddress = await wallet.getAddress();
    const passwordHash = passwordToHash(password);

    await registerPlayerFor(playerAddress, trimmedUsername, passwordHash);

    const chain = process.env.GUEST_CHAIN || "BASE";
    let userRecord;
    try {
      userRecord = await User.create({
        username: trimmedUsername,
        address: playerAddress,
        chain,
        password_hash: passwordHash,
        is_guest: true,
      });
    } catch (dbErr) {
      logger.error({ err: dbErr?.message, playerAddress, username: trimmedUsername }, "Guest user DB create failed after contract register");
      return res.status(500).json({ success: false, message: "Failed to save user" });
    }
    const token = jwt.sign(
      { userId: userRecord.id, address: userRecord.address, username: userRecord.username, isGuest: true },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return res.status(201).json({
      success: true,
      message: "Registered. Connect your wallet later to verify and get full perks.",
      data: {
        token,
        user: { id: userRecord.id, username: userRecord.username, address: userRecord.address, is_guest: true },
      },
    });
  } catch (err) {
    logger.error({ err: err?.message }, "guestRegister failed");
    return res.status(500).json({
      success: false,
      message: err?.message || "Registration failed",
    });
  }
}

/**
 * POST /auth/guest-login
 * Body: { username, password }
 */
export async function guestLogin(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password required" });
    }

    const user = await User.findByUsername(username.trim());
    if (!user || !user.is_guest) {
      return res.status(401).json({ success: false, message: "Invalid username or password" });
    }

    const passwordHash = passwordToHash(password);
    if (user.password_hash !== passwordHash) {
      return res.status(401).json({ success: false, message: "Invalid username or password" });
    }

    const token = jwt.sign(
      { userId: user.id, address: user.address, username: user.username, isGuest: true },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: { id: user.id, username: user.username, address: user.address, is_guest: true },
      },
    });
  } catch (err) {
    logger.error({ err: err?.message }, "guestLogin failed");
    return res.status(500).json({ success: false, message: "Login failed" });
  }
}

/**
 * POST /auth/guest-reregister
 * Authorization: Bearer <token>
 * Body: { password }
 * Re-registers the guest on the current contract (e.g. after redeploy) via registerPlayerFor.
 */
export async function guestReregister(req, res) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  const user = req.user;
  if (!user.is_guest) {
    return res.status(400).json({ success: false, message: "Only guest accounts can re-register" });
  }
  const { password } = req.body;
  if (!password || typeof password !== "string") {
    return res.status(400).json({ success: false, message: "Password required" });
  }
  const passwordHash = passwordToHash(password);
  if (user.password_hash !== passwordHash) {
    return res.status(401).json({ success: false, message: "Invalid password" });
  }
  try {
    const username = (user.username || user.address?.slice(0, 10) || "guest").trim();
    await registerPlayerFor(user.address, username, passwordHash);
    return res.status(200).json({
      success: true,
      message: "Re-registered on the new contract. You can play again.",
    });
  } catch (err) {
    logger.error({ err: err?.message, address: user.address }, "guestReregister failed");
    return res.status(500).json({
      success: false,
      message: err?.message || "Re-registration failed. Try again later.",
    });
  }
}

/**
 * GET /auth/me
 * Authorization: Bearer <token>
 * Returns current user from JWT (do not send password_hash to client).
 */
export async function me(req, res) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  const { password_hash, ...safe } = req.user;
  return res.status(200).json({
    success: true,
    data: safe,
  });
}
