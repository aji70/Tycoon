/**
 * Guest auth: register (create custodial wallet + on-chain registerPlayerFor) and login.
 * Password is hashed with keccak256 to match contract's expected passwordHash.
 * Also: link-wallet, unlink-wallet, login-by-wallet, connect-email, verify-email, login-email.
 */
import crypto from "crypto";
import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import { registerPlayerFor } from "../services/tycoonContract.js";
import logger from "../config/logger.js";

const JWT_SECRET = process.env.JWT_SECRET || "tycoon-guest-secret-change-in-production";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";

/** Hash password the same way the contract expects (keccak256). */
function passwordToHash(password) {
  return ethers.keccak256(ethers.toUtf8Bytes(password));
}

const GUEST_CHAIN_OPTIONS = ["POLYGON", "CELO", "BASE"];

/**
 * POST /auth/guest-register
 * Body: { username, password, chain }
 * chain: required - "POLYGON" | "CELO" | "BASE". Must be sent explicitly by the frontend.
 * Creates a new wallet, registers on-chain via registerPlayerFor, creates user with is_guest=true.
 */
export async function guestRegister(req, res) {
  try {
    const { username, password, chain: bodyChain } = req.body;
    if (!username || typeof username !== "string" || !password || typeof password !== "string") {
      return res.status(400).json({ success: false, message: "Username and password required" });
    }
    if (bodyChain == null || String(bodyChain).trim() === "") {
      return res.status(400).json({ success: false, message: "chain is required (POLYGON, CELO, or BASE)" });
    }
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 2) {
      return res.status(400).json({ success: false, message: "Username too short" });
    }

    const normalizedChain = User.normalizeChain(bodyChain);
    if (!GUEST_CHAIN_OPTIONS.includes(normalizedChain)) {
      return res.status(400).json({ success: false, message: "chain must be POLYGON, CELO, or BASE" });
    }

    const existing = await User.findByUsernameIgnoreCase(trimmedUsername);
    if (existing) {
      return res.status(409).json({ success: false, message: "Username already taken" });
    }

    const wallet = ethers.Wallet.createRandom();
    const playerAddress = await wallet.getAddress();
    const passwordHash = passwordToHash(password);

    const chain = normalizedChain;
    await registerPlayerFor(playerAddress, trimmedUsername, passwordHash, normalizedChain);
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
 * GET /auth/me
 * Authorization: Bearer <token>
 * Returns current user from JWT (do not send password_hash to client).
 */
export async function me(req, res) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  const { password_hash, password_hash_email, email_verification_token, ...safe } = req.user;
  return res.status(200).json({
    success: true,
    data: safe,
  });
}

/**
 * POST /api/auth/link-wallet
 * Guest only. Body: { walletAddress, chain, message, signature }.
 * Verifies signature recovers walletAddress; updates user's linked_wallet_address/chain.
 * Same endpoint for "link first time" and "change linked wallet" (new signature overwrites).
 */
export async function linkWallet(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    if (!req.user.is_guest) {
      return res.status(400).json({ success: false, message: "Only guest accounts can link a wallet" });
    }
    const { walletAddress, chain, message, signature } = req.body;
    if (!walletAddress || !message || !signature) {
      return res.status(400).json({ success: false, message: "walletAddress, message, and signature required" });
    }
    const normalizedChain = User.normalizeChain(chain || "POLYGON");
    if (!GUEST_CHAIN_OPTIONS.includes(normalizedChain)) {
      return res.status(400).json({ success: false, message: "chain must be POLYGON, CELO, or BASE" });
    }
    let recovered;
    try {
      recovered = ethers.verifyMessage(message, signature);
    } catch (e) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }
    const addr = String(walletAddress).trim();
    const recoveredLower = recovered.toLowerCase();
    const addrLower = addr.toLowerCase();
    if (recoveredLower !== addrLower) {
      return res.status(400).json({ success: false, message: "Signature does not match wallet address" });
    }
    const existingByPrimary = await User.findByAddress(addr, normalizedChain);
    if (existingByPrimary && existingByPrimary.id !== req.user.id) {
      return res.status(409).json({ success: false, message: "This wallet is already registered as a primary account" });
    }
    const existingByLinked = await User.findByLinkedWallet(addr, normalizedChain);
    if (existingByLinked && existingByLinked.id !== req.user.id) {
      return res.status(409).json({ success: false, message: "This wallet is already linked to another account" });
    }
    await User.update(req.user.id, {
      linked_wallet_address: addr,
      linked_wallet_chain: normalizedChain,
    });
    const updated = await User.findById(req.user.id);
    const { password_hash: _, ...safe } = updated;
    return res.status(200).json({
      success: true,
      message: "Wallet linked",
      data: safe,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "linkWallet failed");
    return res.status(500).json({ success: false, message: err?.message || "Link failed" });
  }
}

/**
 * POST /api/auth/unlink-wallet
 * Guest only. Removes linked_wallet_address and linked_wallet_chain from current user.
 */
export async function unlinkWallet(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    await User.update(req.user.id, {
      linked_wallet_address: null,
      linked_wallet_chain: null,
    });
    const updated = await User.findById(req.user.id);
    const { password_hash: _, ...safe } = updated;
    return res.status(200).json({
      success: true,
      message: "Wallet unlinked",
      data: safe,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "unlinkWallet failed");
    return res.status(500).json({ success: false, message: err?.message || "Unlink failed" });
  }
}

/**
 * POST /api/auth/login-by-wallet
 * Body: { address, chain, message, signature }.
 * Verifies signature, resolves user by address or linked_wallet_address, issues JWT (same format as guest).
 */
export async function loginByWallet(req, res) {
  try {
    const { address, chain, message, signature } = req.body;
    if (!address || !message || !signature) {
      return res.status(400).json({ success: false, message: "address, message, and signature required" });
    }
    const normalizedChain = User.normalizeChain(chain || "POLYGON");
    let recovered;
    try {
      recovered = ethers.verifyMessage(message, signature);
    } catch (e) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }
    const addr = String(address).trim().toLowerCase();
    if (recovered.toLowerCase() !== addr) {
      return res.status(400).json({ success: false, message: "Signature does not match address" });
    }
    const user = await User.resolveUserByAddress(address, normalizedChain);
    if (!user) {
      return res.status(404).json({ success: false, message: "No account found for this wallet. Register on-chain first or use guest registration." });
    }
    const token = jwt.sign(
      { userId: user.id, address: user.address, username: user.username, isGuest: !!user.is_guest },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    const { password_hash: _, ...safe } = user;
    return res.status(200).json({
      success: true,
      data: {
        token,
        user: safe,
      },
    });
  } catch (err) {
    logger.error({ err: err?.message }, "loginByWallet failed");
    return res.status(500).json({ success: false, message: err?.message || "Login failed" });
  }
}

const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
const SALT_ROUNDS = 10;

/**
 * POST /api/auth/connect-email
 * Requires auth (JWT). Body: { email, password }.
 * Saves email (lowercase) + bcrypt(password); sets email_verified = false; sends verification (magic link). Stub: logs link.
 */
export async function connectEmail(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const { email, password } = req.body;
    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return res.status(400).json({ success: false, message: "email and password required" });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail.includes("@")) {
      return res.status(400).json({ success: false, message: "Invalid email" });
    }
    const existing = await User.findByEmail(normalizedEmail);
    if (existing && existing.id !== req.user.id) {
      return res.status(409).json({ success: false, message: "Email already used by another account" });
    }
    const passwordHashEmail = await bcrypt.hash(password, SALT_ROUNDS);
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);
    await User.update(req.user.id, {
      email: normalizedEmail,
      password_hash_email: passwordHashEmail,
      email_verified: false,
      email_verification_token: token,
      email_verification_expires_at: expiresAt,
    });
    const baseUrl = process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
    if (process.env.NODE_ENV !== "test") {
      logger.info({ userId: req.user.id, email: normalizedEmail, verifyUrl }, "Email verification link (configure SMTP to send email)");
    }
    return res.status(200).json({
      success: true,
      message: "Email added. Check your inbox for the verification link (or see server logs in dev).",
      data: { email: normalizedEmail, email_verified: false },
    });
  } catch (err) {
    logger.error({ err: err?.message }, "connectEmail failed");
    return res.status(500).json({ success: false, message: err?.message || "Connect email failed" });
  }
}

/**
 * GET /api/auth/verify-email?token=... or POST /api/auth/verify-email { token }
 * Validates token, sets email_verified = true, clears token.
 */
export async function verifyEmail(req, res) {
  try {
    const token = req.query.token || req.body?.token;
    if (!token) {
      return res.status(400).json({ success: false, message: "token required (query or body)" });
    }
    const user = await User.findByEmailVerificationToken(token);
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired verification token" });
    }
    await User.update(user.id, {
      email_verified: true,
      email_verification_token: null,
      email_verification_expires_at: null,
    });
    const updated = await User.findById(user.id);
    const { password_hash, password_hash_email, ...safe } = updated;
    return res.status(200).json({
      success: true,
      message: "Email verified. You can now log in with email.",
      data: safe,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "verifyEmail failed");
    return res.status(500).json({ success: false, message: err?.message || "Verification failed" });
  }
}

/**
 * POST /api/auth/login-email
 * Body: { email, password }. Requires email_verified. Returns JWT (same format as guest).
 */
export async function loginEmail(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "email and password required" });
    }
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
    if (!user.email_verified) {
      return res.status(403).json({ success: false, message: "Email not verified. Check your inbox for the verification link." });
    }
    if (!user.password_hash_email) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
    const valid = await bcrypt.compare(password, user.password_hash_email);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
    const token = jwt.sign(
      { userId: user.id, address: user.address, username: user.username, isGuest: !!user.is_guest },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    const { password_hash, password_hash_email, ...safe } = user;
    return res.status(200).json({
      success: true,
      data: { token, user: safe },
    });
  } catch (err) {
    logger.error({ err: err?.message }, "loginEmail failed");
    return res.status(500).json({ success: false, message: err?.message || "Login failed" });
  }
}
