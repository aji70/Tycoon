import crypto from "crypto";
import { ethers } from "ethers";
import User from "../models/User.js";
import logger from "../config/logger.js";

/**
 * Ensure a backend user row exists for a connected MiniPay / wallet address.
 * Used for referral + daily claim without Privy JWT.
 */
export async function ensureUserForWallet(address, chain = "CELO") {
  const trimmed = String(address || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    throw new Error("Invalid wallet address");
  }
  const normalizedChain = User.normalizeChain(chain);
  const existing = await User.resolveUserByAddress(trimmed, normalizedChain);
  if (existing) return existing;

  const base = `mp_${trimmed.slice(2, 8).toLowerCase()}`;
  let username = base;
  let attempt = 0;
  while (attempt < 8) {
    const taken = await User.findByUsernameIgnoreCaseInChain(username, normalizedChain);
    if (!taken) break;
    attempt += 1;
    username = `${base}${attempt}`;
  }

  const secret = crypto.randomBytes(32).toString("hex");
  const passwordHash = ethers.keccak256(ethers.toUtf8Bytes(secret));

  try {
    const user = await User.create({
      username,
      address: trimmed,
      chain: normalizedChain,
      is_guest: false,
      password_hash: passwordHash,
    });
    logger.info({ userId: user.id, address: trimmed, chain: normalizedChain }, "ensureUserForWallet: created user");
    return user;
  } catch (err) {
    const again = await User.resolveUserByAddress(trimmed, normalizedChain);
    if (again) return again;
    throw err;
  }
}
