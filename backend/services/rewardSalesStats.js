import { JsonRpcProvider, Interface, formatUnits } from "ethers";
import logger from "../config/logger.js";
import { getChainConfig } from "../config/chains.js";
import { resolveRewardSystemAddress } from "./rewardSystemContract.js";

const SALES_CACHE_TTL_MS = 10 * 60 * 1000;
const salesCache = new Map();
const VALID_PERIODS = new Set(["all", "day", "week", "month"]);
const BLOCK_CHUNK_SIZE = 50_000;

const REWARD_SALES_ABI = [
  "event CollectibleBought(uint256 indexed tokenId, address indexed buyer, uint256 price, bool usedUsdc)",
  "event CollectibleBoughtWithToken(uint256 indexed tokenId, address indexed buyer, uint256 price, uint8 paymentToken)",
  "event BundleBought(uint256 indexed bundleId, address indexed buyer, uint256 price, bool usedUsdc)",
];

const iface = new Interface(REWARD_SALES_ABI);

function salesCacheKey(chain, period) {
  return `${String(chain || "CELO").toUpperCase()}:${period}`;
}

function normalizePeriod(rawPeriod) {
  const period = String(rawPeriod || "all").toLowerCase();
  return VALID_PERIODS.has(period) ? period : "all";
}

function periodStart(period) {
  const now = Date.now();
  if (period === "day") return new Date(now - 24 * 60 * 60 * 1000);
  if (period === "week") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (period === "month") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return null;
}

function paymentTokenLabel(token) {
  if (token === 0) return "TYC";
  if (token === 1) return "USDC";
  if (token === 2) return "cUSD";
  if (token === 3) return "USDT";
  return `Token ${token}`;
}

function paymentTokenDecimals(token) {
  return token === 0 ? 18 : 6;
}

function bigintReplacer(_key, value) {
  return typeof value === "bigint" ? value.toString() : value;
}

async function getProvider(chain = "CELO") {
  const cfg = getChainConfig(chain);
  if (!cfg?.rpcUrl) throw new Error(`No RPC configured for chain ${chain}`);
  return new JsonRpcProvider(cfg.rpcUrl);
}

async function findBlockAtOrAfterTimestamp(provider, latestBlockNumber, targetDate) {
  const target = Math.floor(targetDate.getTime() / 1000);
  let low = 0;
  let high = latestBlockNumber;
  let answer = latestBlockNumber;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const block = await provider.getBlock(mid);
    const ts = Number(block?.timestamp ?? 0);
    if (ts >= target) {
      answer = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return answer;
}

async function collectLogsForTopic(provider, address, topic0, fromBlock, toBlock) {
  const logs = [];
  for (let start = fromBlock; start <= toBlock; start += BLOCK_CHUNK_SIZE) {
    const end = Math.min(start + BLOCK_CHUNK_SIZE - 1, toBlock);
    const chunk = await provider.getLogs({
      address,
      fromBlock: start,
      toBlock: end,
      topics: [topic0],
    });
    logs.push(...chunk);
  }
  return logs;
}

function buildCurrencyTotals() {
  return {
    TYC: { raw: 0n, formatted: "0", decimals: 18 },
    USDC: { raw: 0n, formatted: "0", decimals: 6 },
    cUSD: { raw: 0n, formatted: "0", decimals: 6 },
    USDT: { raw: 0n, formatted: "0", decimals: 6 },
  };
}

export async function getRewardSalesStats(options = {}) {
  const chain = String(options.chain || "CELO").toUpperCase();
  const period = normalizePeriod(options.period);
  const refresh = options.refresh === true;
  const key = salesCacheKey(chain, period);
  const hit = salesCache.get(key);
  if (!refresh && hit && Date.now() - hit.at < SALES_CACHE_TTL_MS) {
    return hit.data;
  }

  const provider = await getProvider(chain);
  const rewardAddress = await resolveRewardSystemAddress(chain);
  const latestBlock = await provider.getBlockNumber();
  const startDate = periodStart(period);
  const envStart =
    Number(process.env[`${chain}_REWARD_SYSTEM_DEPLOYMENT_BLOCK`]) ||
    Number(process.env.REWARD_SYSTEM_DEPLOYMENT_BLOCK) ||
    0;
  const fromBlock = startDate
    ? await findBlockAtOrAfterTimestamp(provider, latestBlock, startDate)
    : Math.max(0, envStart);

  const collectibleOldTopic = iface.getEvent("CollectibleBought").topicHash;
  const collectibleNewTopic = iface.getEvent("CollectibleBoughtWithToken").topicHash;
  const bundleTopic = iface.getEvent("BundleBought").topicHash;

  try {
    const [oldCollectibleLogs, newCollectibleLogs, bundleLogs] = await Promise.all([
      collectLogsForTopic(provider, rewardAddress, collectibleOldTopic, fromBlock, latestBlock),
      collectLogsForTopic(provider, rewardAddress, collectibleNewTopic, fromBlock, latestBlock),
      collectLogsForTopic(provider, rewardAddress, bundleTopic, fromBlock, latestBlock),
    ]);

    const currencies = buildCurrencyTotals();
    const uniqueBuyers = new Set();
    const newCollectibleKeys = new Set();

    let collectiblesSold = 0;
    let bundlesSold = 0;

    for (const log of newCollectibleLogs) {
      const parsed = iface.parseLog(log);
      const tokenId = Number(parsed.args.tokenId);
      const buyer = String(parsed.args.buyer).toLowerCase();
      const price = BigInt(parsed.args.price);
      const paymentToken = Number(parsed.args.paymentToken);
      if (price <= 0n) continue;
      const keyPart = `${log.transactionHash}:${tokenId}:${buyer}:${price.toString()}`;
      newCollectibleKeys.add(keyPart);
      collectiblesSold += 1;
      uniqueBuyers.add(buyer);
      const label = paymentTokenLabel(paymentToken);
      if (!currencies[label]) {
        currencies[label] = {
          raw: 0n,
          formatted: "0",
          decimals: paymentTokenDecimals(paymentToken),
        };
      }
      currencies[label].raw += price;
    }

    for (const log of oldCollectibleLogs) {
      const parsed = iface.parseLog(log);
      const tokenId = Number(parsed.args.tokenId);
      const buyer = String(parsed.args.buyer).toLowerCase();
      const price = BigInt(parsed.args.price);
      const usedUsdc = Boolean(parsed.args.usedUsdc);
      if (price <= 0n) continue;
      const keyPart = `${log.transactionHash}:${tokenId}:${buyer}:${price.toString()}`;
      if (newCollectibleKeys.has(keyPart)) continue;
      collectiblesSold += 1;
      uniqueBuyers.add(buyer);
      const label = usedUsdc ? "USDC" : "TYC";
      currencies[label].raw += price;
    }

    for (const log of bundleLogs) {
      const parsed = iface.parseLog(log);
      const buyer = String(parsed.args.buyer).toLowerCase();
      const price = BigInt(parsed.args.price);
      const usedUsdc = Boolean(parsed.args.usedUsdc);
      if (price <= 0n) continue;
      bundlesSold += 1;
      uniqueBuyers.add(buyer);
      const label = usedUsdc ? "USDC" : "TYC";
      currencies[label].raw += price;
    }

    for (const entry of Object.values(currencies)) {
      entry.formatted = formatUnits(entry.raw, entry.decimals);
    }

    const data = {
      chain,
      period,
      rewardAddress,
      fromBlock,
      toBlock: latestBlock,
      summary: {
        collectiblesSold,
        bundlesSold,
        totalSales: collectiblesSold + bundlesSold,
        uniqueBuyers: uniqueBuyers.size,
      },
      revenueByCurrency: currencies,
      generatedAt: new Date().toISOString(),
      cachedUntil: new Date(Date.now() + SALES_CACHE_TTL_MS).toISOString(),
    };

    salesCache.set(key, {
      at: Date.now(),
      data: JSON.parse(JSON.stringify(data, bigintReplacer)),
    });
    return data;
  } catch (err) {
    logger.error({ err, chain, period, fromBlock, latestBlock }, "reward sales stats failed");
    throw err;
  }
}
