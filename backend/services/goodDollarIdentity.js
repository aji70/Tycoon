/**
 * GoodDollar Identity reads (Celo): verified = getWhitelistedRoot(addr) != 0x0.
 * Contract addresses match @goodsdks/citizen-sdk chainConfigs (production CELO).
 */
import { Contract, JsonRpcProvider, getAddress, ZeroAddress } from "ethers";
import logger from "../config/logger.js";

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
 * Check linked wallet, smart wallet, and primary address (any verified → bonus).
 * @param {object} user
 * @returns {Promise<boolean>}
 */
export async function isUserGoodDollarVerified(user) {
  if (!user || !isGoodDollarIdentityEnabled()) return false;

  const candidates = [
    user.linked_wallet_address,
    user.smart_wallet_address,
    user.address,
    user.wallet_address,
  ];

  const seen = new Set();
  for (const raw of candidates) {
    const addr = normalizeAddr(raw);
    if (!addr || seen.has(addr.toLowerCase())) continue;
    seen.add(addr.toLowerCase());
    if (await isGoodDollarVerifiedAddress(addr)) return true;
  }
  return false;
}
