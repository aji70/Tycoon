/**
 * Ensures a user has a contract password hash so the backend can act on their behalf
 * (e.g. end AI game, exit game). Guests already have password_hash. Wallet users who
 * registered via the frontend (contract registerPlayer) are already on-chain without
 * a backend password; we can only add one if they're not yet registered on the contract.
 * @param {string} [chain] - Chain (CELO, POLYGON, BASE) for contract calls. Default CELO.
 */
import crypto from "crypto";
import { ethers } from "ethers";
import User from "../models/User.js";
import logger from "../config/logger.js";
import {
  callContractRead,
  registerPlayerFor,
  getSmartWalletAddress,
  isContractConfigured,
  callContractWrite,
  syncBackendPasswordIfMissingOnChain,
} from "../services/tycoonContract.js";
import { getOnchainAddressForGuestFlow } from "./onchainUserAddress.js";

function passwordToHash(password) {
  return ethers.keccak256(ethers.toUtf8Bytes(password));
}

function isValidEthAddress(maybe) {
  return typeof maybe === "string" && /^0x[a-fA-F0-9]{40}$/.test(maybe.trim());
}

/**
 * On-chain username (max 32 bytes per TycoonLib). Must be globally unique on the contract;
 * DB usernames can clash with another player's on-chain name (e.g. wallet "MimahYero" vs guest "MimahYero").
 * @param {number} userId - users.id
 * @param {string|null|undefined} displayUsername - human label from DB (optional)
 */
export function buildContractUsername(userId, displayUsername) {
  const id = Number(userId);
  const safeId = Number.isFinite(id) && id > 0 ? id : null;
  const suffix = safeId != null ? `_id${safeId}` : `_x${crypto.randomBytes(3).toString("hex")}`;
  const raw = (displayUsername && String(displayUsername).trim()) || "p";
  const ascii = raw.replace(/[^\w-]/g, "");
  let base = ascii.slice(0, 20);
  if (!base) base = "p";
  let combined = base + suffix;
  while (Buffer.byteLength(combined, "utf8") > 32) {
    base = base.slice(0, -1);
    if (!base) {
      combined = safeId != null ? `u${safeId}` : `g${crypto.randomBytes(6).toString("hex")}`;
      combined = String(combined).slice(0, 32);
      break;
    }
    combined = base + suffix;
  }
  return combined;
}

/**
 * registerPlayerFor reverts "Username taken" when that string is already mapped to another address
 * (common after linking a new wallet or changing Privy placeholder while keeping the same DB user id).
 */
async function registerPlayerForUniqueUsername(effectiveAddress, passwordHash, uid, displayUsername, normalizedChain) {
  const baseDisplay = (displayUsername && String(displayUsername).trim()) || "p";
  let lastErr;
  for (let attempt = 0; attempt < 12; attempt++) {
    const label = attempt === 0 ? baseDisplay : `${baseDisplay}_r${crypto.randomBytes(3).toString("hex")}`;
    const contractUsername = buildContractUsername(uid, label);
    try {
      await registerPlayerFor(effectiveAddress, contractUsername, passwordHash, normalizedChain);
      return contractUsername;
    } catch (e) {
      lastErr = e;
      const msg = `${e?.reason || ""} ${e?.message || ""} ${e?.shortMessage || ""}`;
      if (!/Username taken/i.test(msg)) {
        throw e;
      }
      logger.warn(
        { userId: uid, attempt, contractUsername, addrPrefix: String(effectiveAddress).slice(0, 12) },
        "registerPlayerFor Username taken — retrying with salted on-chain name"
      );
    }
  }
  throw lastErr || new Error("Username taken after retries");
}

async function readOnChainUsername(effectiveAddress, normalizedChain) {
  try {
    const u = await callContractRead("addressToUsername", [effectiveAddress], normalizedChain);
    const s = u != null ? String(u).trim() : "";
    return s || null;
  } catch {
    return null;
  }
}

/** Must match guestAuthController.placeholderAddressForPrivyDid / gameController.privyPlaceholderAddress */
function privyPlaceholderAddress(privyDid) {
  const id = privyDid && String(privyDid).trim();
  if (!id) return null;
  const hash = crypto.createHash("sha256").update(id).digest("hex").slice(0, 40);
  return `0x${hash}`;
}

/**
 * Same as ensureUserHasContractPassword but returns why it failed (for API / matchmaking errors).
 *
 * @returns {Promise<
 *   | { ok: true, address: string, username: string, password_hash: string }
 *   | { ok: false, reason: string, userId: number, chain?: string }
 * >}
 */
export async function ensureUserHasContractAuthResult(db, userId, chain = "CELO", addressOverride = null) {
  const uid = Number(userId);
  if (!uid) {
    return { ok: false, reason: "Invalid user id for contract auth.", userId: uid };
  }

  const user = await db("users")
    .where({ id: uid })
    .select("address", "linked_wallet_address", "username", "password_hash", "privy_did", "smart_wallet_address")
    .first();

  if (!user) {
    return { ok: false, reason: "User record not found.", userId: uid };
  }

  /** Registry.getWallet expects the profile owner EOA — not the smart wallet contract address. */
  function shouldSyncSmartWalletFromRegistry(eff) {
    const sw = user?.smart_wallet_address && String(user.smart_wallet_address).trim().toLowerCase();
    if (!sw) return true;
    return String(eff).trim().toLowerCase() !== sw;
  }

  let effectiveAddress = null;
  const ov = addressOverride != null ? String(addressOverride).trim() : "";
  if (isValidEthAddress(ov)) effectiveAddress = ov;
  else if (isValidEthAddress(user?.linked_wallet_address)) effectiveAddress = String(user.linked_wallet_address).trim();
  else if (isValidEthAddress(user?.smart_wallet_address)) effectiveAddress = String(user.smart_wallet_address).trim();
  else if (isValidEthAddress(user?.address)) effectiveAddress = String(user.address).trim();
  else if (user?.privy_did) effectiveAddress = privyPlaceholderAddress(user.privy_did);

  if (!effectiveAddress) {
    return {
      ok: false,
      reason:
        "No valid 0x wallet address on this account. Link a wallet in Profile, complete Privy sign-in, or use Register on-chain so the game can create/join matches for you.",
      userId: uid,
    };
  }

  const normalizedChain = User.normalizeChain(chain);
  if (!isContractConfigured(normalizedChain)) {
    return {
      ok: false,
      reason: `Server has no game contract configured for chain ${normalizedChain}. The team must set TYCOON / registry RPC env vars for this chain, or change your account chain to one that is deployed.`,
      userId: uid,
      chain: normalizedChain,
    };
  }

  try {
    const isRegistered = await callContractRead("registered", [effectiveAddress], normalizedChain);
    const displayHint = user?.username || effectiveAddress.slice(0, 10);
    /** Username the Tycoon contract expects for createGameByBackend / joinGameByBackend for this address */
    let usernameForGames = displayHint;

    // If user already has a password_hash in DB but this address is not yet registered on this chain,
    // register it using the existing hash so backend auth works.
    if (user?.password_hash) {
      if (!isRegistered) {
        usernameForGames = await registerPlayerForUniqueUsername(
          effectiveAddress,
          user.password_hash,
          uid,
          user?.username,
          normalizedChain
        );
        if (shouldSyncSmartWalletFromRegistry(effectiveAddress)) {
          const smartWalletAddress = await getSmartWalletAddress(effectiveAddress, normalizedChain);
          await db("users")
            .where({ id: uid })
            .update({ smart_wallet_address: smartWalletAddress || null });
        }
        logger.info(
          { userId: uid, address: effectiveAddress, chain: normalizedChain, contractUsername: usernameForGames },
          "Synced existing backend password to contract for user"
        );
      } else {
        const onChain = await readOnChainUsername(effectiveAddress, normalizedChain);
        if (onChain) usernameForGames = onChain;
        // registerPlayer() can leave registered=true with _passwordHashOf unset; backend txs need the hash.
        await syncBackendPasswordIfMissingOnChain(
          effectiveAddress,
          user.password_hash,
          usernameForGames,
          1500,
          normalizedChain
        );
      }
      return { ok: true, address: effectiveAddress, username: usernameForGames, password_hash: user.password_hash };
    }

    // No password_hash in DB yet.
    const secret = crypto.randomBytes(32).toString("hex");
    const passwordHash = passwordToHash(secret);
    if (isRegistered) {
      // Already registered on-chain without a backend password: set backend password via controller helper.
      await callContractWrite("setBackendPasswordFor", [effectiveAddress, passwordHash], normalizedChain);
      const onChain = await readOnChainUsername(effectiveAddress, normalizedChain);
      if (onChain) usernameForGames = onChain;
    } else {
      usernameForGames = await registerPlayerForUniqueUsername(
        effectiveAddress,
        passwordHash,
        uid,
        user?.username,
        normalizedChain
      );
    }
    const updateRow = { password_hash: passwordHash };
    if (shouldSyncSmartWalletFromRegistry(effectiveAddress)) {
      const smartWalletAddress = await getSmartWalletAddress(effectiveAddress, normalizedChain);
      updateRow.smart_wallet_address = smartWalletAddress || null;
    }
    await db("users").where({ id: uid }).update(updateRow);
    logger.info(
      { userId: uid, address: effectiveAddress, chain: normalizedChain, contractUsername: usernameForGames },
      "Registered user on contract with backend password for future game-end"
    );
    return { ok: true, address: effectiveAddress, username: usernameForGames, password_hash: passwordHash };
  } catch (err) {
    const detail = err?.reason || err?.message || String(err);
    logger.warn({ err: detail, userId: uid, chain: normalizedChain }, "ensureUserHasContractAuthResult failed");
    return {
      ok: false,
      reason: `On-chain registration or password sync failed (${detail}). Check RPC, game controller wallet funding, and that this address can register on ${normalizedChain}.`,
      userId: uid,
      chain: normalizedChain,
    };
  }
}

/**
 * Guest/Privy create & join: same as ensureUserHasContractAuthResult with smart address resolution.
 * If the first attempt fails, retries with no override so DB order (linked → smart → address → Privy placeholder) can recover from a bad primary `users.address`.
 *
 * @param {object} user - Row from users (needs id; privy_did / wallet columns used for resolution)
 * @returns {Promise<{ ok: true, address: string, username: string, password_hash: string } | { ok: false, reason: string }>}
 */
export async function ensureGuestContractPlayReady(db, user, chain = "CELO") {
  const normalized = User.normalizeChain(chain);
  if (!user?.id) {
    return { ok: false, reason: "Invalid user for on-chain setup." };
  }

  const override = getOnchainAddressForGuestFlow(user);
  let r = await ensureUserHasContractAuthResult(db, user.id, normalized, override);
  if (!r.ok && override) {
    const r2 = await ensureUserHasContractAuthResult(db, user.id, normalized, null);
    if (r2.ok) {
      logger.info(
        { userId: user.id, chain: normalized },
        "ensureGuestContractPlayReady: succeeded after retry without address override"
      );
      r = r2;
    }
  }

  if (!r.ok) {
    return { ok: false, reason: r.reason };
  }
  return { ok: true, address: r.address, username: r.username, password_hash: r.password_hash };
}

/**
 * Returns user with address, username, password_hash so backend can call createGameByBackend/joinGameByBackend etc.
 * If addressOverride is provided (e.g. linked_wallet_address), uses that for contract; otherwise uses user.address.
 * Ensures that address is registered on-chain with a backend password (syncs from DB or registers if not on-chain).
 *
 * @param {object} db - Knex instance
 * @param {number} userId - users.id
 * @param {string} [chain] - Chain (CELO, POLYGON, BASE) for contract. Default CELO.
 * @param {string} [addressOverride] - Address to use for contract (e.g. linked_wallet_address). If not set, uses user.address.
 * @returns {Promise<{ address: string, username: string, password_hash: string } | null>}
 */
export async function ensureUserHasContractPassword(db, userId, chain = "CELO", addressOverride = null) {
  const r = await ensureUserHasContractAuthResult(db, userId, chain, addressOverride);
  if (!r.ok) {
    logger.warn({ userId, reason: r.reason }, "ensureUserHasContractPassword failed");
    return null;
  }
  return { address: r.address, username: r.username, password_hash: r.password_hash };
}
