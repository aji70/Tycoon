/**
 * Guest auth: register (create custodial wallet + on-chain registerPlayerFor) and login.
 * Password is hashed with keccak256 to match contract's expected passwordHash.
 * Also: link-wallet, unlink-wallet, login-by-wallet, connect-email, verify-email, login-email, privy-signin.
 */
import crypto from "crypto";
import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { PrivyClient, verifyAccessToken } from "@privy-io/node";
import db from "../config/database.js";
import User from "../models/User.js";
import {
  registerPlayerFor,
  getSmartWalletAddress,
  callContractRead,
  isContractConfigured,
  createWalletForExistingUser,
  canCreateWalletForExistingUser,
} from "../services/tycoonContract.js";
import logger from "../config/logger.js";

const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
// Support key in .env with literal \n (e.g. "-----BEGIN...\n...\n-----END...") or real newlines
const rawKey = process.env.PRIVY_JWT_VERIFICATION_KEY;
const PRIVY_JWT_VERIFICATION_KEY = rawKey ? rawKey.replace(/\\n/g, "\n") : undefined;
const privyClientOpts = { appId: PRIVY_APP_ID, appSecret: PRIVY_APP_SECRET };
if (PRIVY_JWT_VERIFICATION_KEY) privyClientOpts.jwtVerificationKey = PRIVY_JWT_VERIFICATION_KEY;
const privyClient = PRIVY_APP_ID && PRIVY_APP_SECRET ? new PrivyClient(privyClientOpts) : null;
if (privyClient && PRIVY_APP_ID) {
  const masked = PRIVY_APP_ID.length > 8 ? `${PRIVY_APP_ID.slice(0, 4)}...${PRIVY_APP_ID.slice(-4)}` : "***";
  logger.info({ privyAppIdMasked: masked, hasJwtKey: !!PRIVY_JWT_VERIFICATION_KEY }, "Privy configured for /auth/privy-signin — ensure frontend NEXT_PUBLIC_PRIVY_APP_ID matches this app ID");
}

/**
 * GET /auth/privy-check
 * Returns whether Privy is configured and masked app ID so you can verify backend matches frontend.
 * Call this on your deployed backend (e.g. Railway) to confirm PRIVY_APP_ID/PRIVY_APP_SECRET are set and match.
 */
export function privyCheck(_req, res) {
  const configured = !!(PRIVY_APP_ID && PRIVY_APP_SECRET);
  const masked = PRIVY_APP_ID && PRIVY_APP_ID.length > 8 ? `${PRIVY_APP_ID.slice(0, 4)}...${PRIVY_APP_ID.slice(-4)}` : null;
  res.json({
    privyConfigured: configured,
    privyAppIdMasked: masked,
    hasJwtVerificationKey: !!PRIVY_JWT_VERIFICATION_KEY,
    hint: configured
      ? `Backend app ID should match frontend NEXT_PUBLIC_PRIVY_APP_ID (e.g. cmm9...qh9z). If token verification still fails, add PRIVY_JWT_VERIFICATION_KEY from Privy Dashboard → Configuration → App settings.`
      : "Set PRIVY_APP_ID and PRIVY_APP_SECRET in backend env (same Privy app as frontend).",
  });
}

/** Placeholder address for Privy-only users (unique per privy_did, valid 0x hex). */
function placeholderAddressForPrivyDid(privyDid) {
  const hash = crypto.createHash("sha256").update(privyDid).digest("hex").slice(0, 40);
  return `0x${hash}`;
}

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
    const smartWalletAddress = await getSmartWalletAddress(playerAddress, normalizedChain);
    let userRecord;
    try {
      userRecord = await User.create({
        username: trimmedUsername,
        address: playerAddress,
        chain,
        password_hash: passwordHash,
        is_guest: true,
        smart_wallet_address: smartWalletAddress || null,
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
 * POST /auth/privy-signin
 * Body: { username } (required on first sign-in for this Privy user)
 * Authorization: Bearer <privy_access_token>
 *
 * Combines Privy with our guest auth: same users table, same JWT shape. Privy = no password;
 * we verify the Privy token and link one username to that Privy account (privy_did).
 * Returning users are found by privy_did and get our JWT with no username prompt.
 */
export async function privySignin(req, res) {
  try {
    if (!privyClient) {
      return res.status(503).json({ success: false, message: "Privy not configured" });
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Authorization required (Bearer <privy_token>)" });
    }
    const privyToken = authHeader.slice(7);
    if (!PRIVY_JWT_VERIFICATION_KEY) {
      return res.status(503).json({
        success: false,
        message:
          "Privy JWT verification key not configured. Set PRIVY_JWT_VERIFICATION_KEY in backend env (from Privy Dashboard → Configuration → App settings → Verify with key instead).",
      });
    }
    let claims;
    try {
      const result = await verifyAccessToken({
        access_token: privyToken,
        app_id: PRIVY_APP_ID,
        verification_key: PRIVY_JWT_VERIFICATION_KEY,
      });
      claims = { sub: result.user_id, userId: result.user_id };
    } catch (err) {
      // Decode token payload without verifying (for debug only) to see app_id/issuer in token
      let tokenPayloadHint = null;
      try {
        const parts = privyToken.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
          tokenPayloadHint = { iss: payload.iss, aud: payload.aud, app_id: payload.app_id, exp: payload.exp };
        }
      } catch (_) {}
      const privyErrorMsg = err?.message || String(err);
      logger.warn(
        {
          err: privyErrorMsg,
          code: err?.code,
          tokenPayloadHint,
          backendAppIdMasked: PRIVY_APP_ID ? `${PRIVY_APP_ID.slice(0, 4)}...${PRIVY_APP_ID.slice(-4)}` : "missing",
          hasJwtKey: !!PRIVY_JWT_VERIFICATION_KEY,
        },
        "Privy token verification failed"
      );
      return res.status(401).json({
        success: false,
        message: `Invalid or expired Privy token. (${privyErrorMsg})`,
      });
    }
    const privyDid = claims?.sub ?? claims?.userId;
    if (!privyDid || typeof privyDid !== "string") {
      return res.status(401).json({ success: false, message: "Invalid Privy token payload" });
    }

    let user = await User.findByPrivyDid(privyDid);
    if (user) {
      const token = jwt.sign(
        { userId: user.id, address: user.address, username: user.username, isGuest: true },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );
      const { password_hash, password_hash_email, email_verification_token, ...safe } = user;
      return res.status(200).json({
        success: true,
        data: {
          token,
          user: { id: safe.id, username: safe.username, address: safe.address, is_guest: true, privy_did: safe.privy_did, email: safe.email, email_verified: safe.email_verified },
        },
      });
    }

    // Sync existing account by email: if Privy user has email, find our user by that email and link privy_did
    let privyEmail = null;
    try {
      const privyUser = await privyClient.users()._get(privyDid);
      if (privyUser && privyUser.linked_accounts && Array.isArray(privyUser.linked_accounts)) {
        const emailAccount = privyUser.linked_accounts.find((a) => a && a.type === "email" && a.address);
        if (emailAccount) {
          privyEmail = String(emailAccount.address).trim().toLowerCase();
        }
      }
      if (!privyEmail && privyUser?.email?.address) {
        privyEmail = String(privyUser.email.address).trim().toLowerCase();
      }
    } catch (e) {
      logger.debug({ err: e?.message }, "Privy get user by id failed (optional for email sync)");
    }
    if (privyEmail) {
      const existingByEmail = await User.findByEmail(privyEmail);
      if (existingByEmail && !existingByEmail.privy_did) {
        await User.update(existingByEmail.id, { privy_did: privyDid });
        user = await User.findById(existingByEmail.id);
        const token = jwt.sign(
          { userId: user.id, address: user.address, username: user.username, isGuest: !!user.is_guest },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRY }
        );
        const { password_hash, password_hash_email, email_verification_token, ...safe } = user;
        return res.status(200).json({
          success: true,
          message: "Existing account linked with Privy.",
          data: {
            token,
            user: { id: safe.id, username: safe.username, address: safe.address, is_guest: !!safe.is_guest, privy_did: safe.privy_did, email: safe.email, email_verified: safe.email_verified },
          },
        });
      }
    }

    const username = req.body?.username;
    if (!username || typeof username !== "string" || username.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Username required (min 2 characters) for first-time Privy sign-in" });
    }
    const trimmedUsername = username.trim();
    const existing = await User.findByUsernameIgnoreCase(trimmedUsername);
    if (existing) {
      return res.status(409).json({ success: false, message: "Username already taken" });
    }

    const address = placeholderAddressForPrivyDid(privyDid);
    const chain = "CELO";
    user = await User.create({
      username: trimmedUsername,
      address,
      chain,
      privy_did: privyDid,
      is_guest: true,
    });
    const token = jwt.sign(
      { userId: user.id, address: user.address, username: user.username, isGuest: true },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    const { password_hash, password_hash_email, email_verification_token, ...safe } = user;
    return res.status(201).json({
      success: true,
      message: "Account created. You can link a wallet and email in profile.",
      data: {
        token,
        user: { id: safe.id, username: safe.username, address: safe.address, is_guest: true, privy_did: safe.privy_did, email: safe.email, email_verified: safe.email_verified },
      },
    });
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack }, "privySignin failed");
    return res.status(500).json({ success: false, message: err?.message || "Sign-in failed" });
  }
}

/**
 * POST /auth/register-on-chain
 * Registers the authenticated user on the game contract (backend signs as game controller).
 * Use when the user has a backend account but is not registered on-chain (e.g. "Not registered" on create game).
 * Body: { chain?: "CELO" | "POLYGON" | "BASE" } (optional, defaults to user's chain or CELO).
 */
export async function registerOnChain(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const user = req.user;
    const placeholderAddr = user.privy_did ? placeholderAddressForPrivyDid(user.privy_did) : null;
    const primaryIsPlaceholder = placeholderAddr && user.address && String(user.address).toLowerCase() === String(placeholderAddr).toLowerCase();
    const addrForChain = user.linked_wallet_address && String(user.linked_wallet_address).trim()
      ? String(user.linked_wallet_address).trim()
      : primaryIsPlaceholder ? null : user.address;
    if (!addrForChain) {
      return res.status(400).json({ success: false, message: "Link a wallet first (Profile) or use Register to create one" });
    }
    const chain = User.normalizeChain(req.body?.chain || user.chain || "CELO");
    if (!isContractConfigured(chain)) {
      return res.status(503).json({ success: false, message: "Contract not configured for this network" });
    }
    const isRegistered = await callContractRead("registered", [addrForChain], chain);
    if (isRegistered) {
      return res.status(200).json({ success: true, alreadyRegistered: true, message: "Already registered on-chain" });
    }
    const secret = crypto.randomBytes(32).toString("hex");
    const passwordHash = ethers.keccak256(ethers.toUtf8Bytes(secret));
    await registerPlayerFor(addrForChain, user.username || addrForChain.slice(0, 10), passwordHash, chain);
    const smartWalletAddress = await getSmartWalletAddress(addrForChain, chain);
    await db("users")
      .where({ id: user.id })
      .update({ password_hash: passwordHash, smart_wallet_address: smartWalletAddress || null });
    logger.info({ userId: user.id, address: addrForChain, chain }, "registerOnChain: registered user on contract");
    return res.status(200).json({
      success: true,
      alreadyRegistered: false,
      message: "Registered on-chain. You can create games now.",
    });
  } catch (err) {
    logger.error({ err: err?.message, userId: req.user?.id }, "registerOnChain failed");
    return res.status(500).json({
      success: false,
      message: err?.message || "Failed to register on-chain",
    });
  }
}

/**
 * GET /auth/me
 * Authorization: Bearer <token>
 * Returns current user from JWT (do not send password_hash to client).
 * After Privy sign-in: if user has a real address (linked wallet or non-placeholder), ensures they are
 * registered on-chain and have a smart wallet (registers them if not, then syncs smart_wallet_address).
 */
export async function me(req, res) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  const { password_hash, password_hash_email, email_verification_token, ...safe } = req.user;
  const chain = req.user.chain || "CELO";
  const normalizedChain = User.normalizeChain(chain);

  // Real address for on-chain: prefer linked wallet; else primary address only if not Privy placeholder
  const placeholderAddr = req.user.privy_did ? placeholderAddressForPrivyDid(req.user.privy_did) : null;
  const primaryIsPlaceholder = placeholderAddr && req.user.address && String(req.user.address).toLowerCase() === String(placeholderAddr).toLowerCase();
  const addrForChain = safe.linked_wallet_address && String(safe.linked_wallet_address).trim()
    ? String(safe.linked_wallet_address).trim()
    : primaryIsPlaceholder ? null : req.user.address;

  if (addrForChain && isContractConfigured(normalizedChain)) {
    try {
      const isRegistered = await callContractRead("registered", [addrForChain], normalizedChain);
      if (!isRegistered) {
        const username = req.user.username || req.user.address?.slice(0, 10) || "Player";
        const secret = crypto.randomBytes(32).toString("hex");
        const passwordHash = ethers.keccak256(ethers.toUtf8Bytes(secret));
        await registerPlayerFor(addrForChain, username, passwordHash, normalizedChain);
        const smartWallet = await getSmartWalletAddress(addrForChain, normalizedChain);
        await db("users").where({ id: req.user.id }).update({
          password_hash: passwordHash,
          smart_wallet_address: smartWallet || null,
        });
        safe.smart_wallet_address = smartWallet || safe.smart_wallet_address;
        logger.info({ userId: req.user.id, address: addrForChain, chain: normalizedChain }, "me: registered user on-chain and synced smart wallet");
      } else if (safe.smart_wallet_address == null || safe.smart_wallet_address === "") {
        let smartWallet = await getSmartWalletAddress(addrForChain, normalizedChain);
        if (!smartWallet && canCreateWalletForExistingUser()) {
          try {
            smartWallet = await createWalletForExistingUser(addrForChain, normalizedChain);
            if (smartWallet) {
              logger.info({ userId: req.user.id, address: addrForChain }, "me: created smart wallet for existing user");
            }
          } catch (err) {
            logger.warn({ err: err?.message, address: addrForChain }, "me: createWalletForExistingUser failed");
            safe.needs_smart_wallet_creation = true;
          }
        }
        if (!smartWallet) {
          safe.needs_smart_wallet_creation = true;
        }
        if (smartWallet) {
          await User.update(req.user.id, { smart_wallet_address: smartWallet });
          safe.smart_wallet_address = smartWallet;
        }
      }
    } catch (err) {
      logger.warn({ err: err?.message, userId: req.user.id }, "me: ensure on-chain / smart wallet failed");
      if (safe.smart_wallet_address == null || safe.smart_wallet_address === "") {
        try {
          const addrToTry = safe.linked_wallet_address && String(safe.linked_wallet_address).trim() ? safe.linked_wallet_address : req.user.address;
          if (addrToTry) {
            const smartWallet = await getSmartWalletAddress(addrToTry, normalizedChain);
            if (smartWallet) {
              await User.update(req.user.id, { smart_wallet_address: smartWallet });
              safe.smart_wallet_address = smartWallet;
            }
          }
        } catch (syncErr) {
          logger.warn({ err: syncErr?.message, userId: req.user.id }, "me: sync smart_wallet_address failed");
        }
      }
    }
  } else if (safe.smart_wallet_address == null || safe.smart_wallet_address === "") {
    const addrToTry = safe.linked_wallet_address && String(safe.linked_wallet_address).trim() ? safe.linked_wallet_address : req.user.address;
    if (addrToTry) {
      try {
        const smartWallet = await getSmartWalletAddress(addrToTry, normalizedChain);
        if (smartWallet) {
          await User.update(req.user.id, { smart_wallet_address: smartWallet });
          safe.smart_wallet_address = smartWallet;
        }
      } catch (err) {
        logger.warn({ err: err?.message, userId: req.user.id }, "me: sync smart_wallet_address failed");
      }
    }
  }

  return res.status(200).json({
    success: true,
    data: safe,
  });
}

/**
 * POST /api/auth/link-wallet
 * Guest and Privy users. Body: { walletAddress, chain, message, signature }.
 * Verifies signature recovers walletAddress; updates user's linked_wallet_address/chain.
 * Same endpoint for "link first time" and "change linked wallet" (new signature overwrites).
 * After linking, /auth/me will register them on-chain and sync smart_wallet_address.
 */
export async function linkWallet(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const canLink = req.user.is_guest === true || (req.user.privy_did && String(req.user.privy_did).trim());
    if (!canLink) {
      return res.status(400).json({ success: false, message: "Only guest or Privy accounts can link a wallet" });
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
      // Merge current user (guest/Privy) into EOA account, keeping EOA's username
      const sourceId = req.user.id;
      const walletUserId = existingByPrimary.id;
      const guestGameIds = await db("game_players").where({ user_id: sourceId }).select("game_id");
      const guestGameIdSet = new Set(guestGameIds.map((r) => r.game_id));
      if (guestGameIdSet.size > 0) {
        const overlap = await db("game_players")
          .where({ user_id: walletUserId })
          .whereIn("game_id", [...guestGameIdSet])
          .first();
        if (overlap) {
          return res.status(409).json({
            success: false,
            message:
              "Cannot merge: you and your wallet account are both in the same game. Finish or leave that game first, then try again.",
          });
        }
      }
      const sourceUser = await User.findById(sourceId);
      if (!sourceUser) return res.status(401).json({ success: false, message: "Account not found" });

      await db.transaction(async (trx) => {
        await trx("game_players").where({ user_id: sourceId }).update({ user_id: walletUserId, updated_at: db.fn.now() });
        await trx("games").where({ creator_id: sourceId }).update({ creator_id: walletUserId, updated_at: db.fn.now() });
        await trx("player_votes").where({ voter_user_id: sourceId }).update({ voter_user_id: walletUserId });
        await trx("player_votes").where({ target_user_id: sourceId }).update({ target_user_id: walletUserId });
        await trx("end_by_networth_votes").where({ user_id: sourceId }).update({ user_id: walletUserId });
        if (await trx.schema.hasTable("tournament_entries")) {
          await trx("tournament_entries").where({ user_id: sourceId }).update({ user_id: walletUserId });
        }
        const cols = User.chainColumns(normalizedChain);
        if (cols) {
          const guestPlayed = Number(sourceUser[cols.played] ?? 0);
          const guestWon = Number(sourceUser[cols.won] ?? 0);
          if (guestPlayed > 0 || guestWon > 0) {
            await trx("users").where({ id: walletUserId }).increment(cols.played, guestPlayed).increment(cols.won, guestWon).update({ updated_at: db.fn.now() });
          }
        }
        const gp = Number(sourceUser.games_played ?? 0);
        const gw = Number(sourceUser.game_won ?? 0);
        const gl = Number(sourceUser.game_lost ?? 0);
        if (gp > 0 || gw > 0 || gl > 0) {
          await trx("users").where({ id: walletUserId }).increment("games_played", gp).increment("game_won", gw).increment("game_lost", gl).update({ updated_at: db.fn.now() });
        }
        const privyDid = sourceUser.privy_did && String(sourceUser.privy_did).trim() ? sourceUser.privy_did.trim() : null;
        const emailUpdate = sourceUser.email && String(sourceUser.email).trim() && !existingByPrimary.email
          ? { email: sourceUser.email.trim().toLowerCase(), ...(sourceUser.email_verified ? { email_verified: true } : {}) }
          : null;
        // Clear source user's privy_did first to avoid unique constraint violation, then assign to wallet user
        if (privyDid) {
          await trx("users").where({ id: sourceId }).update({ privy_did: null, updated_at: db.fn.now() });
          await trx("users").where({ id: walletUserId }).update({ privy_did: privyDid, updated_at: db.fn.now() });
        }
        if (emailUpdate) {
          await trx("users").where({ id: walletUserId }).update({ ...emailUpdate, updated_at: db.fn.now() });
        }
        await trx("users").where({ id: sourceId }).del();
      });

      const updatedWalletUser = await User.findById(walletUserId);
      const token = jwt.sign(
        { userId: updatedWalletUser.id, address: updatedWalletUser.address, username: updatedWalletUser.username, isGuest: !!updatedWalletUser.is_guest },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );
      const { password_hash: _p, ...safe } = updatedWalletUser;
      return res.status(200).json({
        success: true,
        message: "Accounts merged. You are now signed in as your wallet account.",
        data: { token, user: safe },
      });
    }
    const existingByLinked = await User.findByLinkedWallet(addr, normalizedChain);
    if (existingByLinked && existingByLinked.id !== req.user.id) {
      return res.status(409).json({ success: false, message: "This wallet is already linked to another account" });
    }
    await User.update(req.user.id, {
      linked_wallet_address: addr,
      linked_wallet_chain: normalizedChain,
    });
    let updated = await User.findById(req.user.id);
    try {
      const smartWallet = await getSmartWalletAddress(addr, normalizedChain);
      if (smartWallet) {
        await User.update(req.user.id, { smart_wallet_address: smartWallet });
        updated = await User.findById(req.user.id);
      }
    } catch (err) {
      logger.warn({ err: err?.message, userId: req.user.id }, "linkWallet: sync smart_wallet_address failed");
    }
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
 * POST /api/auth/merge-guest-into-wallet
 * Guest only. Body: { walletAddress, chain, message, signature }.
 * Verifies signature, finds user by wallet (primary address). Transfers guest's game participations,
 * created games, votes, and stats to the wallet user, then deletes the guest account.
 * Returns JWT for the wallet user so the client can switch session.
 * Fails if the wallet is already linked to another account or if guest and wallet user are both in the same game.
 */
export async function mergeGuestIntoWallet(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    if (!req.user.is_guest) {
      return res.status(400).json({ success: false, message: "Only guest accounts can be merged into a wallet" });
    }
    const guestId = req.user.id;
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
    const addr = String(walletAddress).trim().toLowerCase();
    const recoveredLower = recovered.toLowerCase();
    if (recoveredLower !== addr) {
      return res.status(400).json({ success: false, message: "Signature does not match wallet address" });
    }
    const walletUser = await User.findByAddress(walletAddress, normalizedChain);
    if (!walletUser) {
      return res.status(404).json({
        success: false,
        message: "No account found for this wallet. Register on-chain first (e.g. play one game with this wallet), then merge.",
      });
    }
    const walletUserId = walletUser.id;
    if (walletUserId === guestId) {
      return res.status(400).json({ success: false, message: "Guest and wallet are the same account" });
    }
    const existingByLinked = await User.findByLinkedWallet(addr, normalizedChain);
    if (existingByLinked && existingByLinked.id !== guestId) {
      return res.status(409).json({ success: false, message: "This wallet is already linked to another account" });
    }
    const guestGameIds = await db("game_players").where({ user_id: guestId }).select("game_id");
    const guestGameIdSet = new Set(guestGameIds.map((r) => r.game_id));
    if (guestGameIdSet.size > 0) {
      const overlap = await db("game_players")
        .where({ user_id: walletUserId })
        .whereIn("game_id", [...guestGameIdSet])
        .first();
      if (overlap) {
        return res.status(409).json({
          success: false,
          message:
            "Cannot merge: you and your wallet account are both in the same game. Finish or leave that game first, then merge.",
        });
      }
    }
    const guest = await User.findById(guestId);
    if (!guest) return res.status(401).json({ success: false, message: "Guest account not found" });

    await db.transaction(async (trx) => {
      await trx("game_players").where({ user_id: guestId }).update({ user_id: walletUserId, updated_at: db.fn.now() });
      await trx("games").where({ creator_id: guestId }).update({ creator_id: walletUserId, updated_at: db.fn.now() });
      await trx("player_votes").where({ voter_user_id: guestId }).update({ voter_user_id: walletUserId });
      await trx("player_votes").where({ target_user_id: guestId }).update({ target_user_id: walletUserId });
      await trx("end_by_networth_votes").where({ user_id: guestId }).update({ user_id: walletUserId });
      if (await trx.schema.hasTable("tournament_entries")) {
        await trx("tournament_entries").where({ user_id: guestId }).update({ user_id: walletUserId });
      }
      const cols = User.chainColumns(normalizedChain);
      if (cols) {
        const guestPlayed = Number(guest[cols.played] ?? 0);
        const guestWon = Number(guest[cols.won] ?? 0);
        if (guestPlayed > 0 || guestWon > 0) {
          await trx("users").where({ id: walletUserId }).increment(cols.played, guestPlayed).increment(cols.won, guestWon).update({ updated_at: db.fn.now() });
        }
      }
      const gp = Number(guest.games_played ?? 0);
      const gw = Number(guest.game_won ?? 0);
      const gl = Number(guest.game_lost ?? 0);
      if (gp > 0 || gw > 0 || gl > 0) {
        await trx("users").where({ id: walletUserId }).increment("games_played", gp).increment("game_won", gw).increment("game_lost", gl).update({ updated_at: db.fn.now() });
      }
      await trx("users").where({ id: guestId }).del();
    });

    const updatedWalletUser = await User.findById(walletUserId);
    const token = jwt.sign(
      { userId: updatedWalletUser.id, address: updatedWalletUser.address, username: updatedWalletUser.username, isGuest: !!updatedWalletUser.is_guest },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    const { password_hash: _, ...safe } = updatedWalletUser;
    return res.status(200).json({
      success: true,
      message: "Guest account merged into wallet. You are now signed in as your wallet account.",
      data: { token, user: safe },
    });
  } catch (err) {
    logger.error({ err: err?.message }, "mergeGuestIntoWallet failed");
    return res.status(500).json({ success: false, message: err?.message || "Merge failed" });
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
