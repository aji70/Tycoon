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
import { callContractRead, registerPlayerFor, getSmartWalletAddress, isContractConfigured } from "../services/tycoonContract.js";

function passwordToHash(password) {
  return ethers.keccak256(ethers.toUtf8Bytes(password));
}

/**
 * Returns user with address, username, password_hash so backend can call endAIGameByBackend/exitGameByBackend.
 * If user has no password_hash, tries to register them on the contract with a generated password (only if
 * they're not already registered on-chain). Wallet users who already registered via frontend cannot get
 * a backend password; we return null for them so contract end is skipped.
 *
 * @param {object} db - Knex instance
 * @param {number} userId - users.id
 * @param {string} [chain] - Chain (CELO, POLYGON, BASE) for contract. Default CELO.
 * @returns {Promise<{ address: string, username: string, password_hash: string } | null>}
 */
export async function ensureUserHasContractPassword(db, userId, chain = "CELO") {
  const user = await db("users").where({ id: userId }).select("address", "username", "password_hash").first();
  if (!user?.address) return null;
  if (user.password_hash) return user;

  const normalizedChain = User.normalizeChain(chain);
  if (!isContractConfigured(normalizedChain)) return null;
  try {
    const isRegistered = await callContractRead("registered", [user.address], normalizedChain);
    if (isRegistered) {
      // Already on contract (e.g. wallet user who used frontend registerPlayer) — we can't add a password
      return null;
    }
    const secret = crypto.randomBytes(32).toString("hex");
    const passwordHash = passwordToHash(secret);
    await registerPlayerFor(user.address, user.username || user.address.slice(0, 10), passwordHash, normalizedChain);
    const smartWalletAddress = await getSmartWalletAddress(user.address, normalizedChain);
    await db("users")
      .where({ id: userId })
      .update({ password_hash: passwordHash, smart_wallet_address: smartWalletAddress || null });
    logger.info({ userId, address: user.address, chain: normalizedChain }, "Registered user on contract with backend password for future game-end");
    return { ...user, password_hash: passwordHash };
  } catch (err) {
    logger.warn({ err: err?.message, userId }, "ensureUserHasContractPassword failed");
    return null;
  }
}
