import logger from "../config/logger.js";
import { collectAppContractAddresses } from "../config/appContractAddresses.js";

/** Blockscout API v2 counters base URL per chain id. */
const BLOCKSCOUT_BASE = {
  42220: "https://explorer.celo.org/mainnet/api/v2",
  44787: "https://celo-alfajores.blockscout.com/api/v2",
  137: "https://polygon.blockscout.com/api/v2",
  8453: "https://base.blockscout.com/api/v2",
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();
const VALID_PERIODS = new Set(["all", "day", "week", "month"]);

function cacheKey(chainId, address, period = "all") {
  return `${chainId}:${address.toLowerCase()}:${period}`;
}

function explorerAddressUrl(chainId, address) {
  if (chainId === 42220) return `https://celoscan.io/address/${address}`;
  if (chainId === 44787) return `https://alfajores.celoscan.io/address/${address}`;
  if (chainId === 137) return `https://polygonscan.com/address/${address}`;
  if (chainId === 8453) return `https://basescan.org/address/${address}`;
  return `https://celoscan.io/address/${address}`;
}

async function fetchTxCountFromBlockscout(chainId, address) {
  const base = BLOCKSCOUT_BASE[chainId];
  if (!base) {
    return { txCount: null, error: `No explorer configured for chainId ${chainId}` };
  }

  const key = cacheKey(chainId, address);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.data;
  }

  try {
    const url = `${base}/addresses/${address}/counters`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      const err = `Explorer HTTP ${res.status}`;
      const data = { txCount: null, error: err };
      cache.set(key, { at: Date.now(), data });
      return data;
    }
    const body = await res.json();
    const raw = body?.transactions_count ?? body?.transactionsCount;
    const txCount = raw != null && raw !== "" ? Number(raw) : null;
    const data = {
      txCount: Number.isFinite(txCount) ? txCount : null,
      tokenTransfers: body?.token_transfers_count != null ? Number(body.token_transfers_count) : null,
      error: null,
    };
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    logger.warn({ err: err?.message, chainId, address }, "contractTxStats fetch failed");
    const data = { txCount: null, error: err?.message || "Explorer request failed" };
    cache.set(key, { at: Date.now() - CACHE_TTL_MS + 60_000, data });
    return data;
  }
}

function getPeriodStart(period) {
  const now = new Date();
  if (period === "day") {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  if (period === "week") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (period === "month") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return null;
}

async function countWindowedItems(base, address, endpoint, cutoff) {
  let count = 0;
  let nextPageParams = null;
  let shouldContinue = true;

  while (shouldContinue) {
    const url = new URL(`${base}/addresses/${address}/${endpoint}`);
    if (nextPageParams) {
      for (const [k, v] of Object.entries(nextPageParams)) {
        if (v != null) url.searchParams.set(k, String(v));
      }
    }

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`Explorer HTTP ${res.status}`);
    }

    const body = await res.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) break;

    for (const item of items) {
      const rawTimestamp = item?.timestamp;
      const ts = rawTimestamp ? new Date(rawTimestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) continue;
      if (ts >= cutoff) {
        count += 1;
      } else {
        shouldContinue = false;
        break;
      }
    }

    if (!shouldContinue || !body?.next_page_params) break;
    nextPageParams = body.next_page_params;
  }

  return count;
}

async function fetchWindowedTxCountFromBlockscout(chainId, address, period) {
  const base = BLOCKSCOUT_BASE[chainId];
  if (!base) {
    return { txCount: null, tokenTransfers: null, error: `No explorer configured for chainId ${chainId}` };
  }

  const key = cacheKey(chainId, address, period);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.data;
  }

  const cutoff = getPeriodStart(period);
  if (!cutoff) {
    return fetchTxCountFromBlockscout(chainId, address);
  }

  try {
    const [txCount, tokenTransfers] = await Promise.all([
      countWindowedItems(base, address, "transactions", cutoff),
      countWindowedItems(base, address, "token-transfers", cutoff),
    ]);

    const data = { txCount, tokenTransfers, error: null };
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    logger.warn({ err: err?.message, chainId, address, period }, "contractTxStats range fetch failed");
    const data = { txCount: null, tokenTransfers: null, error: err?.message || "Explorer request failed" };
    cache.set(key, { at: Date.now() - CACHE_TTL_MS + 60_000, data });
    return data;
  }
}

/**
 * @param {{ refresh?: boolean, period?: "all"|"day"|"week"|"month" }} options
 */
export async function getContractTxStats(options = {}) {
  if (options.refresh) cache.clear();
  const period = VALID_PERIODS.has(options.period) ? options.period : "all";

  const addresses = collectAppContractAddresses();
  const contracts = await Promise.all(
    addresses.map(async (row) => {
      const stats =
        period === "all"
          ? await fetchTxCountFromBlockscout(row.chainId, row.address)
          : await fetchWindowedTxCountFromBlockscout(row.chainId, row.address, period);
      return {
        ...row,
        txCount: stats.txCount,
        tokenTransfers: stats.tokenTransfers ?? null,
        explorerUrl: explorerAddressUrl(row.chainId, row.address),
        error: stats.error,
      };
    })
  );

  const configured = contracts.length;
  const withCounts = contracts.filter((c) => c.txCount != null).length;
  const totalTxns = contracts.reduce((s, c) => s + (c.txCount ?? 0), 0);

  return {
    contracts,
    summary: { configured, withCounts, totalTxns },
    period,
    cachedUntil: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    generatedAt: new Date().toISOString(),
  };
}
