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
import { callContractRead, registerPlayerFor, getSmartWalletAddress, isContractConfigured, callContractWrite } from "../services/tycoonContract.js";

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
  const user = await db("users")
    .where({ id: userId })
    .select("address", "username", "password_hash", "privy_did", "smart_wallet_address")
    .first();

  /** Registry.getWallet expects the profile owner EOA — not the smart wallet contract address. */
  function shouldSyncSmartWalletFromRegistry(eff) {
    const sw = user?.smart_wallet_address && String(user.smart_wallet_address).trim().toLowerCase();
    if (!sw) return true;
    return String(eff).trim().toLowerCase() !== sw;
  }

  let effectiveAddress = null;
  const ov = addressOverride != null ? String(addressOverride).trim() : "";
  if (isValidEthAddress(ov)) effectiveAddress = ov;
  else if (isValidEthAddress(user?.address)) effectiveAddress = String(user.address).trim();
  else if (user?.privy_did) effectiveAddress = privyPlaceholderAddress(user.privy_did);

  if (!effectiveAddress) return null;

  const normalizedChain = User.normalizeChain(chain);
  if (!isContractConfigured(normalizedChain)) return null;
  try {
    const isRegistered = await callContractRead("registered", [effectiveAddress], normalizedChain);
    const displayHint = user?.username || effectiveAddress.slice(0, 10);
    /** Username the Tycoon contract expects for createGameByBackend / joinGameByBackend for this address */
    let usernameForGames = displayHint;

    // If user already has a password_hash in DB but this address is not yet registered on this chain,
    // register it using the existing hash so backend auth works.
    if (user?.password_hash) {
      if (!isRegistered) {
        usernameForGames = buildContractUsername(userId, user?.username);
        await registerPlayerFor(effectiveAddress, usernameForGames, user.password_hash, normalizedChain);
        if (shouldSyncSmartWalletFromRegistry(effectiveAddress)) {
          const smartWalletAddress = await getSmartWalletAddress(effectiveAddress, normalizedChain);
          await db("users")
            .where({ id: userId })
            .update({ smart_wallet_address: smartWalletAddress || null });
        }
        logger.info(
          { userId, address: effectiveAddress, chain: normalizedChain, contractUsername: usernameForGames },
          "Synced existing backend password to contract for user"
        );
      } else {
        const onChain = await readOnChainUsername(effectiveAddress, normalizedChain);
        if (onChain) usernameForGames = onChain;
      }
      return { address: effectiveAddress, username: usernameForGames, password_hash: user.password_hash };
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
      usernameForGames = buildContractUsername(userId, user?.username);
      await registerPlayerFor(effectiveAddress, usernameForGames, passwordHash, normalizedChain);
    }
    const updateRow = { password_hash: passwordHash };
    if (shouldSyncSmartWalletFromRegistry(effectiveAddress)) {
      const smartWalletAddress = await getSmartWalletAddress(effectiveAddress, normalizedChain);
      updateRow.smart_wallet_address = smartWalletAddress || null;
    }
    await db("users").where({ id: userId }).update(updateRow);
    logger.info(
      { userId, address: effectiveAddress, chain: normalizedChain, contractUsername: usernameForGames },
      "Registered user on contract with backend password for future game-end"
    );
    return { address: effectiveAddress, username: usernameForGames, password_hash: passwordHash };
  } catch (err) {
    logger.warn({ err: err?.message, userId }, "ensureUserHasContractPassword failed");
    return null;
  }
}
