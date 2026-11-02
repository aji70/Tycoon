/**
 * GoodDollar (G$) shop payment helpers.
 *
 * Pay-with-G$ is off-chain-verified: user transfers G$ ERC-20 to the configured
 * treasury, backend parses the Celo tx log, and only then calls the existing
 * `deliverCollectible` / `deliverBundle` minter paths on TycoonRewardSystem.
 * No contract redeploy is required.
 *
 * G$ on Celo is 18 decimals despite the GoodDollar docs listing "2 decimals"
 * (that figure describes the Fuse-native representation).
 */

import { Contract, JsonRpcProvider, Interface, getAddress, isAddress } from "ethers";
import logger from "../config/logger.js";

export const GOODDOLLAR_CELO_TOKEN = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";
export const GOODDOLLAR_DECIMALS = 18;
const GOODDOLLAR_SCALE = 10n ** BigInt(GOODDOLLAR_DECIMALS);

const CELO_CHAIN_ID = 42220;
const CELO_RPC_FALLBACK = "https://forno.celo.org";

const TRANSFER_IFACE = new Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

const CACHED_PROVIDERS = new Map();

function getCeloProvider() {
  const url = String(process.env.CELO_RPC_URL || "").trim() || CELO_RPC_FALLBACK;
  const cached = CACHED_PROVIDERS.get(url);
  if (cached) return cached;
  const provider = new JsonRpcProvider(url, { chainId: CELO_CHAIN_ID, name: "celo" });
  CACHED_PROVIDERS.set(url, provider);
  return provider;
}

function normalizeAddress(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!isAddress(trimmed)) return null;
  return getAddress(trimmed);
}

export function getGoodDollarTokenAddress() {
  const override = normalizeAddress(process.env.GD_TOKEN_ADDRESS);
  return override || getAddress(GOODDOLLAR_CELO_TOKEN);
}

/**
 * Treasury that receives G$ transfers. Defaults to REWARD_CONTRACT_ADDRESS so
 * the owner can later `withdrawFunds` for G$; override with GD_SHOP_TREASURY_ADDRESS.
 */
export function getGoodDollarTreasury() {
  const override = normalizeAddress(process.env.GD_SHOP_TREASURY_ADDRESS);
  if (override) return override;
  return normalizeAddress(process.env.REWARD_CONTRACT_ADDRESS);
}

/**
 * G$ per 1 USD. Default 14286 (≈$0.00007/G$); set GD_USD_RATE to tune.
 */
export function getGoodDollarUsdRate() {
  const raw = Number(process.env.GD_USD_RATE);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 14286;
}

/**
 * Convert a USD number (e.g. perk's USDC price) to G$ wei (18 decimals).
 * Integer path via micro-USD (1e6) so FE/BE never disagree by dust wei:
 *   gdWei = round(usd * 1e6) * rate * 1e12
 */
export function usdToGoodDollarWei(usdAmount) {
  const usd = Number(usdAmount);
  if (!Number.isFinite(usd) || usd <= 0) return 0n;
  const microUsd = BigInt(Math.round(usd * 1e6));
  if (microUsd <= 0n) return 0n;
  const rate = BigInt(Math.round(getGoodDollarUsdRate()));
  if (rate <= 0n) return 0n;
  return microUsd * rate * 10n ** 12n;
}

/** Exact G$ wei from on-chain USDC price (6 decimals) — preferred when available. */
export function usdcWeiToGoodDollarWei(usdcPriceWei) {
  const usdc = typeof usdcPriceWei === "bigint" ? usdcPriceWei : BigInt(String(usdcPriceWei || "0"));
  if (usdc <= 0n) return 0n;
  const rate = BigInt(Math.round(getGoodDollarUsdRate()));
  if (rate <= 0n) return 0n;
  return usdc * rate * 10n ** 12n;
}

/** Allow tiny float/legacy dust underpayment (1e6 wei = 0.000001 G$). */
export const GOODDOLLAR_PAYMENT_DUST_WEI = 1_000_000n;

export function formatGoodDollarDisplay(weiValue) {
  const wei = typeof weiValue === "bigint" ? weiValue : BigInt(String(weiValue || "0"));
  const whole = wei / GOODDOLLAR_SCALE;
  return whole.toString();
}

export function isGoodDollarShopEnabled() {
  if (String(process.env.GD_SHOP_ENABLED || "").trim().toLowerCase() === "false") return false;
  return Boolean(getGoodDollarTreasury());
}

const ERC20_READ_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

export async function readGoodDollarDecimals() {
  try {
    const token = new Contract(getGoodDollarTokenAddress(), ERC20_READ_ABI, getCeloProvider());
    const d = await token.decimals();
    return Number(d);
  } catch (err) {
    logger.warn({ err: err?.message }, "readGoodDollarDecimals failed, assuming 18");
    return GOODDOLLAR_DECIMALS;
  }
}

/**
 * Verify a Celo tx is a G$ transfer from `expectedFrom` to `expectedTo` of at
 * least `minAmountWei`. Returns the parsed Transfer args + block number.
 *
 * Throws on malformed / failed / wrong-token / underpaid tx. Caller is
 * responsible for idempotency (DB tx_hash unique).
 */
export async function verifyGoodDollarTransfer({ txHash, expectedFrom, expectedTo, minAmountWei }) {
  const hash = String(txHash || "").trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    throw new Error("Invalid txHash");
  }
  const from = normalizeAddress(expectedFrom);
  const to = normalizeAddress(expectedTo);
  if (!from || !to) throw new Error("Invalid from/to");
  const minAmount = typeof minAmountWei === "bigint" ? minAmountWei : BigInt(String(minAmountWei));
  if (minAmount <= 0n) throw new Error("Invalid minAmountWei");

  const provider = getCeloProvider();
  const tokenAddress = getGoodDollarTokenAddress();

  const receipt = await provider.getTransactionReceipt(hash);
  if (!receipt) throw new Error("Transaction not found on Celo yet");
  if (receipt.status !== 1) throw new Error("Transaction reverted on-chain");

  const transfers = [];
  for (const log of receipt.logs || []) {
    if (!log?.address) continue;
    if (log.address.toLowerCase() !== tokenAddress.toLowerCase()) continue;
    try {
      const parsed = TRANSFER_IFACE.parseLog({ topics: log.topics, data: log.data });
      if (!parsed || parsed.name !== "Transfer") continue;
      transfers.push({
        from: getAddress(parsed.args.from),
        to: getAddress(parsed.args.to),
        value: BigInt(parsed.args.value),
      });
    } catch (_) {
      // not a Transfer event
    }
  }

  if (transfers.length === 0) {
    throw new Error("No G$ Transfer log in this transaction");
  }

  const match = transfers.find(
    (t) => t.from.toLowerCase() === from.toLowerCase() && t.to.toLowerCase() === to.toLowerCase()
  );
  if (!match) {
    throw new Error("Transaction does not transfer G$ from buyer to shop treasury");
  }
  const floorAccepted =
    minAmount > GOODDOLLAR_PAYMENT_DUST_WEI ? minAmount - GOODDOLLAR_PAYMENT_DUST_WEI : 0n;
  if (match.value < floorAccepted) {
    throw new Error(
      `Underpaid: expected at least ${minAmount.toString()} G$ wei, got ${match.value.toString()}`
    );
  }

  return {
    txHash: hash,
    from: match.from,
    to: match.to,
    valueWei: match.value,
    blockNumber: Number(receipt.blockNumber || 0),
  };
}
