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
  const user = await db("users").where({ id: userId }).select("address", "username", "password_hash").first();
  const effectiveAddress = (addressOverride && String(addressOverride).trim()) || user?.address;
  if (!effectiveAddress) return null;

  const normalizedChain = User.normalizeChain(chain);
  if (!isContractConfigured(normalizedChain)) return null;
  try {
    const isRegistered = await callContractRead("registered", [effectiveAddress], normalizedChain);
    const username = user?.username || effectiveAddress.slice(0, 10);

    // If user already has a password_hash in DB but this address is not yet registered on this chain,
    // register it using the existing hash so backend auth works.
    if (user?.password_hash) {
      if (!isRegistered) {
        await registerPlayerFor(effectiveAddress, username, user.password_hash, normalizedChain);
        const smartWalletAddress = await getSmartWalletAddress(effectiveAddress, normalizedChain);
        await db("users")
          .where({ id: userId })
          .update({ smart_wallet_address: smartWalletAddress || null });
        logger.info(
          { userId, address: effectiveAddress, chain: normalizedChain },
          "Synced existing backend password to contract for user"
        );
      }
      return { address: effectiveAddress, username, password_hash: user.password_hash };
    }

    // No password_hash in DB yet.
    const secret = crypto.randomBytes(32).toString("hex");
    const passwordHash = passwordToHash(secret);
    if (isRegistered) {
      // Already registered on-chain without a backend password: set backend password via controller helper.
      await callContractWrite("setBackendPasswordFor", [effectiveAddress, passwordHash], normalizedChain);
    } else {
      await registerPlayerFor(effectiveAddress, username, passwordHash, normalizedChain);
    }
    const smartWalletAddress = await getSmartWalletAddress(effectiveAddress, normalizedChain);
    await db("users")
      .where({ id: userId })
      .update({ password_hash: passwordHash, smart_wallet_address: smartWalletAddress || null });
    logger.info(
      { userId, address: effectiveAddress, chain: normalizedChain },
      "Registered user on contract with backend password for future game-end"
    );
    return { address: effectiveAddress, username, password_hash: passwordHash };
  } catch (err) {
    logger.warn({ err: err?.message, userId }, "ensureUserHasContractPassword failed");
    return null;
  }
}
