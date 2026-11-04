/**
 * GoodDollar Identity reads (Celo): verified = getWhitelistedRoot(addr) != 0x0.
 * Contract addresses match @goodsdks/citizen-sdk chainConfigs (production CELO).
 */
import { Contract, JsonRpcProvider, getAddress, ZeroAddress } from "ethers";
import logger from "../config/logger.js";
import { isGoodDollarPlayOpenToAll } from "./platformSettings.js";

const CELO_CHAIN_ID = 42220;

/** @type {Record<string, { identityContract: string }>} */
const CONTRACTS_BY_ENV = {
  production: {
    identityContract: "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42",
  },
  staging: {
    identityContract: "0x0108BBc09772973aC27983Fc17c7D82D8e87ef4D",
  },
  development: {
    identityContract: "0xF25fA0D4896271228193E782831F6f3CFCcF169C",
  },
};

const IDENTITY_ABI = [
  "function getWhitelistedRoot(address account) view returns (address)",
];

const CACHE_TTL_MS = 60_000;
/** @type {Map<string, { v: boolean, at: number }>} */
const cache = new Map();

function gdEnv() {
  const e = String(process.env.GD_ENV || "production").trim().toLowerCase();
  return e === "staging" || e === "development" ? e : "production";
}

export function getGoodDollarIdentityContractAddress() {
  const override = process.env.GD_IDENTITY_CONTRACT?.trim();
  if (override) return override;
  return CONTRACTS_BY_ENV[gdEnv()]?.identityContract;
}

export function isGoodDollarIdentityEnabled() {
  if (process.env.GD_IDENTITY_ENABLED === "false") return false;
  return Boolean(process.env.CELO_RPC_URL && getGoodDollarIdentityContractAddress());
}

function normalizeAddr(addr) {
  if (!addr) return null;
  const s = String(addr).trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(s)) return null;
  if (s.toLowerCase() === ZeroAddress.toLowerCase()) return null;
  try {
    return getAddress(s);
  } catch {
    return null;
  }
}

/**
 * @param {string} address
 * @returns {Promise<boolean>}
 */
export async function isGoodDollarVerifiedAddress(address) {
  const addr = normalizeAddr(address);
  if (!addr || !isGoodDollarIdentityEnabled()) return false;

  const cacheKey = `${gdEnv()}:${addr.toLowerCase()}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.v;

  const rpcUrl = process.env.CELO_RPC_URL;
  const contractAddress = getGoodDollarIdentityContractAddress();
  if (!rpcUrl || !contractAddress) return false;

  try {
    const provider = new JsonRpcProvider(rpcUrl, CELO_CHAIN_ID);
    const identity = new Contract(contractAddress, IDENTITY_ABI, provider);
    const root = await identity.getWhitelistedRoot(addr);
    const verified = Boolean(root && String(root).toLowerCase() !== ZeroAddress.toLowerCase());
    cache.set(cacheKey, { v: verified, at: now });
    return verified;
  } catch (err) {
    logger.warn({ err: err?.message, address: addr }, "GoodDollar identity check failed");
    return false;
  }
}

/**
 * Normalized, deduped list of addresses that will be checked for a user.
 * Order matches the verification check order (linked → smart → primary → wallet),
 * so callers that only want to display one "primary" can take `[0]`.
 * @param {object} user
 * @returns {string[]}
 */
export function getUserGoodDollarCandidateAddresses(user) {
  if (!user) return [];
  const raw = [
    user.linked_wallet_address,
    user.smart_wallet_address,
    user.address,
    user.wallet_address,
  ];
  const seen = new Set();
  const out = [];
  for (const r of raw) {
    const addr = normalizeAddr(r);
    if (!addr) continue;
    const key = addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(addr);
  }
  return out;
}

/**
 * Full verification detail for a user: which addresses were checked and the
 * overall verified bit. Short-circuits on the first verified address.
 * @param {object} user
 * @returns {Promise<{ verified: boolean, checkedAddresses: string[] }>}
 */
export async function getUserGoodDollarVerificationDetail(user) {
  const checkedAddresses = getUserGoodDollarCandidateAddresses(user);
  if (!user || !isGoodDollarIdentityEnabled() || checkedAddresses.length === 0) {
    return { verified: false, checkedAddresses };
  }
  for (const addr of checkedAddresses) {
    if (await isGoodDollarVerifiedAddress(addr)) {
      return { verified: true, checkedAddresses };
    }
  }
  return { verified: false, checkedAddresses };
}

/**
 * Check linked wallet, smart wallet, and primary address (any verified → bonus).
 * @param {object} user
 * @returns {Promise<boolean>}
 */
export async function isUserGoodDollarVerified(user) {
  const detail = await getUserGoodDollarVerificationDetail(user);
  return detail.verified;
}

/** MiniPay clients may send boolean or string; accept common truthy forms. */
export function isMiniPayRequestFlag(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

/**
 * Wallets allowed to create games / Arena agent games without G$ Identity.
 * Always includes the ops wallet; extra addresses via GD_PLAY_GATE_EXEMPT_ADDRESSES (comma-separated).
 */
const DEFAULT_PLAY_GATE_EXEMPT_ADDRESSES = [
  "0x08D70694d7B98F411867ceF75Bd1175D9289B6F6",
];

/** @returns {Set<string>} lowercase checksum-insensitive addresses */
export function getGoodDollarPlayGateExemptSet() {
  const set = new Set(
    DEFAULT_PLAY_GATE_EXEMPT_ADDRESSES.map((a) => a.toLowerCase())
  );
  const raw = String(process.env.GD_PLAY_GATE_EXEMPT_ADDRESSES || "").trim();
  if (raw) {
    for (const part of raw.split(/[\s,]+/)) {
      const addr = normalizeAddr(part);
      if (addr) set.add(addr.toLowerCase());
    }
  }
  return set;
}

/**
 * True if any of the user's candidate wallets is on the play-gate exempt list.
 * Does NOT grant daily-claim bypass — only create-game / Arena gates.
 * @param {object} user
 */
export function isGoodDollarPlayGateExempt(user) {
  const exempt = getGoodDollarPlayGateExemptSet();
  if (exempt.size === 0) return false;
  for (const addr of getUserGoodDollarCandidateAddresses(user)) {
    if (exempt.has(addr.toLowerCase())) return true;
  }
  return false;
}

/**
 * Server-enforced G$ Identity gate for MiniPay play actions (create game, Arena, etc.).
 * Returns a Response if blocked; null if the request may continue.
 * @param {import("express").Response} res
 * @param {object} user
 * @param {unknown} is_minipay
 */
export async function rejectUnverifiedMiniPayGoodDollar(res, user, is_minipay) {
  if (process.env.GD_REQUIRE_FOR_MINIPAY_ACTIONS !== "true") return null;
  if (!isMiniPayRequestFlag(is_minipay)) return null;
  // Admin System Settings toggle — open play for testing without Face Verification.
  if (await isGoodDollarPlayOpenToAll()) return null;
  if (isGoodDollarPlayGateExempt(user)) return null;
  const verified = await isUserGoodDollarVerified(user);
  if (verified) return null;
  return res.status(403).json({
    success: false,
    code: "GOODID_REQUIRED",
    message: "Verify your humanity with GoodDollar to play on MiniPay.",
    verifyUrl: "https://goodid.gooddollar.org/",
  });
}
