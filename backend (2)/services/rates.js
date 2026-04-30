/**
 * Fetch CELO → USD and USD → NGN rates from public APIs for CELO→Naira conversion.
 * - CELO/USD: CoinGecko (no key; rate limited)
 * - USD/NGN: ExchangeRate-API open endpoint (open.er-api.com, no key)
 * Rates are cached for a short period to avoid hitting rate limits.
 */

import logger from "../config/logger.js";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cache = { celoUsd: null, usdNgn: null, at: 0 };

/**
 * Fetch CELO price in USD from CoinGecko.
 * @returns {Promise<number>} Price per 1 CELO in USD
 */
export async function fetchCeloUsd() {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=celo&vs_currencies=usd",
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`CoinGecko CELO/USD failed: ${res.status}`);
  const data = await res.json();
  const usd = data?.celo?.usd;
  if (usd == null || typeof usd !== "number") throw new Error("CoinGecko: missing celo.usd");
  return usd;
}

/**
 * Fetch USD to NGN rate from ExchangeRate-API (open, no key).
 * @returns {Promise<number>} Units of NGN per 1 USD
 */
export async function fetchUsdNgn() {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`ExchangeRate-API USD/NGN failed: ${res.status}`);
  const data = await res.json();
  const ngn = data?.rates?.NGN;
  if (ngn == null || typeof ngn !== "number") throw new Error("ExchangeRate-API: missing rates.NGN");
  return ngn;
}

/**
 * Get CELO → NGN rate (NGN per 1 CELO). Uses cache if fresh.
 * @returns {Promise<number>} NGN per 1 CELO
 */
export async function getCeloToNgnRate() {
  const now = Date.now();
  if (cache.celoUsd != null && cache.usdNgn != null && now - cache.at < CACHE_TTL_MS) {
    return cache.celoUsd * cache.usdNgn;
  }
  const [celoUsd, usdNgn] = await Promise.all([fetchCeloUsd(), fetchUsdNgn()]);
  cache = { celoUsd, usdNgn, at: now };
  logger.info({ celoUsd, usdNgn, celoToNgn: celoUsd * usdNgn }, "Rates: CELO/USD and USD/NGN updated");
  return celoUsd * usdNgn;
}

/**
 * Convert amount of CELO to NGN using live rates (with cache).
 * @param {number} amountCelo - Amount of CELO
 * @returns {Promise<number>} Equivalent NGN (rounded to integer)
 */
export async function celoToNgn(amountCelo) {
  const rate = await getCeloToNgnRate();
  return Math.round(amountCelo * rate);
}

/**
 * Convert NGN to CELO using live rates (with cache). For "Buy CELO with Naira" flow.
 * @param {number} amountNgn - Amount in Naira
 * @returns {Promise<number>} Equivalent CELO (fractional)
 */
export async function ngnToCelo(amountNgn) {
  const rate = await getCeloToNgnRate();
  if (rate <= 0) throw new Error("CELO/NGN rate must be positive");
  return amountNgn / rate;
}
