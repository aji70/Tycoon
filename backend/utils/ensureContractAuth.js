/**
 * Ensures a user has a contract password hash so the backend can act on their behalf
 * (e.g. end AI game, exit game). Guests already have password_hash. Wallet users who
 * registered via the frontend (contract registerPlayer) are already on-chain without
 * a backend password; we can only add one if they're not yet registered on the contract.
 */
import crypto from "crypto";
import { ethers } from "ethers";
import logger from "../config/logger.js";
import { callContractRead, registerPlayerFor, isContractConfigured } from "../services/tycoonContract.js";

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
 * @returns {Promise<{ address: string, username: string, password_hash: string } | null>}
 */
export async function ensureUserHasContractPassword(db, userId) {
  const user = await db("users").where({ id: userId }).select("address", "username", "password_hash").first();
  if (!user?.address) return null;
  if (user.password_hash) return user;

  if (!isContractConfigured()) return null;
  try {
    const isRegistered = await callContractRead("registered", [user.address]);
    if (isRegistered) {
      // Already on contract (e.g. wallet user who used frontend registerPlayer) — we can't add a password
      return null;
    }
    const secret = crypto.randomBytes(32).toString("hex");
    const passwordHash = passwordToHash(secret);
    await registerPlayerFor(user.address, user.username || user.address.slice(0, 10), passwordHash);
    await db("users").where({ id: userId }).update({ password_hash: passwordHash });
    logger.info({ userId, address: user.address }, "Registered user on contract with backend password for future game-end");
    return { ...user, password_hash: passwordHash };
  } catch (err) {
    logger.warn({ err: err?.message, userId }, "ensureUserHasContractPassword failed");
    return null;
  }
}
