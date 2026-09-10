import { JsonRpcProvider, Contract, formatUnits, ZeroAddress } from "ethers";
import logger from "../config/logger.js";
import redis from "../config/redis.js";
import db from "../config/database.js";
import { getChainConfig } from "../config/chains.js";
import { loadOverviewMetrics } from "./adminDashboardController.js";
import { getContractTxStats } from "../services/contractTxStats.js";
import { resolveRewardSystemAddress } from "../services/rewardSystemContract.js";

const CACHE_TTL_SECONDS = Number(process.env.PUBLIC_STATS_CACHE_TTL_SECONDS) || 120;

/** Native USDT on Celo mainnet. Overridable via env; falls back to the known mainnet address. */
const CELO_USDT_ADDRESS =
  process.env.CELO_USDT_ADDRESS ||
  process.env.USDT_ADDRESS ||
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e";

const ERC20_BALANCE_ABI = [
  "function balanceOf(address) view returns (uint256)",
];

/** AI seat accounts use `AI_` usernames — never surface them as the top player. */
function isAiUsername(username) {
  return typeof username === "string" && username.toUpperCase().startsWith("AI_");
}

/** Distinct players (by game membership) and games-per-player, plus the top human player (AI seats excluded). */
async function loadPlayerEngagement() {
  const [uniqueRow, membershipRow, topRows] = await Promise.all([
    db("game_players").countDistinct("user_id as c").first(),
    db("game_players").count("* as c").first(),
    db("game_players")
      .select("user_id")
      .count("* as games")
      .whereNotNull("user_id")
      .groupBy("user_id")
      .orderBy("games", "desc")
      .limit(25),
  ]);

  const uniquePlayers = Number(uniqueRow?.c ?? 0);
  const memberships = Number(membershipRow?.c ?? 0);
  const gamesPerPlayer = uniquePlayers > 0 ? memberships / uniquePlayers : 0;

  let mostActivePlayer = null;
  const ids = topRows.map((r) => r.user_id);
  if (ids.length > 0) {
    const users = await db("users").whereIn("id", ids).select("id", "username");
    const usernameById = new Map(users.map((u) => [u.id, u.username ?? null]));
    for (const row of topRows) {
      const username = usernameById.get(row.user_id) ?? null;
      if (isAiUsername(username)) continue;
      mostActivePlayer = { username, games: Number(row.games ?? 0) };
      break;
    }
  }

  return {
    uniquePlayers,
    gamesPerPlayer: Math.round(gamesPerPlayer * 10) / 10,
    mostActivePlayer,
  };
}

/** Current USDT left in the reward contract (leftover after withdrawals — NOT lifetime revenue). */
async function loadPerkShopTreasuryBalanceUsdt() {
  try {
    const cfg = getChainConfig("CELO");
    if (!cfg?.rpcUrl) return null;
    const rewardAddress = await resolveRewardSystemAddress("CELO");
    if (!rewardAddress || rewardAddress === ZeroAddress) return null;

    const provider = new JsonRpcProvider(cfg.rpcUrl);
    const usdt = new Contract(CELO_USDT_ADDRESS, ERC20_BALANCE_ABI, provider);
    const balance = await usdt.balanceOf(rewardAddress);
    const value = Number.parseFloat(formatUnits(balance, 6));
    return Number.isFinite(value) ? value : 0;
  } catch (err) {
    logger.warn({ err }, "public stats: perk shop USDT balance unavailable");
    return null;
  }
}

/**
 * Lifetime perk revenue from DB purchase rows (fast).
 * Does NOT scan chain logs here — getRewardSalesStats is too slow for /public/stats.
 * Treasury balance is returned separately as leftover cash after withdrawals.
 */
async function loadPerkShopLifetimeRevenue() {
  const out = {
    method: "db_inflows_plus_treasury_balance",
    perkShopRevenueUsdt: null,
    totalStableUsd: null,
    byCurrency: null,
    tipPacksUsdc: 0,
    softPerksStableUsd: 0,
    shopSales: null,
    treasuryBalanceUsdt: null,
  };

  const paymentLabel = (token) => {
    const t = Number(token);
    if (t === 0) return "TYC";
    if (t === 1) return "USDC";
    if (t === 2) return "cUSD";
    if (t === 3) return "USDT";
    return null;
  };

  try {
    const [tipRows, softRows, treasuryBalanceUsdt] = await Promise.all([
      db.schema.hasTable("game_ai_tip_pack_purchases").then(async (has) =>
        has ? db("game_ai_tip_pack_purchases").select("amount_usdc") : []
      ),
      db.schema.hasTable("soft_perk_purchases").then(async (has) =>
        has
          ? db("soft_perk_purchases").select("amount", "payment_token", "entitlement")
          : []
      ),
      loadPerkShopTreasuryBalanceUsdt(),
    ]);

    out.treasuryBalanceUsdt = treasuryBalanceUsdt;

    let tipSum = 0;
    for (const r of tipRows || []) {
      const n = Number(r.amount_usdc);
      if (Number.isFinite(n)) tipSum += n;
    }
    out.tipPacksUsdc = tipSum;

    // Soft perk rows already include tip packs (entitlement ai_tip_pack) — skip those.
    let softUsdt = 0;
    let softUsdc = 0;
    let softCusd = 0;
    for (const r of softRows || []) {
      if (r.entitlement === "ai_tip_pack") continue;
      const label = paymentLabel(r.payment_token);
      if (!label || label === "TYC") continue;
      try {
        const raw = BigInt(String(r.amount || "0"));
        const human = Number(formatUnits(raw, 6));
        if (!Number.isFinite(human)) continue;
        if (label === "USDT") softUsdt += human;
        else if (label === "USDC") softUsdc += human;
        else if (label === "cUSD") softCusd += human;
      } catch {
        /* ignore */
      }
    }
    out.softPerksStableUsd = softUsdt + softUsdc + softCusd;

    const totalStable = out.tipPacksUsdc + out.softPerksStableUsd;
    out.byCurrency = {
      USDT: softUsdt,
      USDC: softUsdc + out.tipPacksUsdc,
      cUSD: softCusd,
      tipPacksUsdc: out.tipPacksUsdc,
      softPerksStableUsd: out.softPerksStableUsd,
      TYC: 0,
    };
    out.totalStableUsd = Math.round(totalStable * 1e6) / 1e6;
    // Prefer recorded inflows; if none yet, fall back to treasury leftover so the card isn't blank.
    out.perkShopRevenueUsdt =
      out.totalStableUsd > 0 ? out.totalStableUsd : treasuryBalanceUsdt;
    return out;
  } catch (err) {
    logger.warn({ err }, "public stats: lifetime perk revenue unavailable");
    out.treasuryBalanceUsdt = await loadPerkShopTreasuryBalanceUsdt();
    out.perkShopRevenueUsdt = out.treasuryBalanceUsdt;
    return out;
  }
}

/**
 * GET /api/public/stats
 * Query: period=all|day|week|month
 *
 * Heavy aggregate counts — served from Redis (short TTL) so anonymous polling
 * never fans out into full-table COUNT(*) scans on every request.
 */
export async function getPublicStats(req, res) {
  try {
    const periodParam = String(req.query.period || "all").toLowerCase();
    // v2 cache key: revenue definition changed from treasury balance → lifetime inflows
    const cacheKey = `public:stats:v2:${periodParam}`;

    const cached = await redis.getJSON(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const { metrics, period } = await loadOverviewMetrics(req.query.period);
    const contractStats = await getContractTxStats({ period });
    const [engagement, perkRevenue] = await Promise.all([
      loadPlayerEngagement(),
      loadPerkShopLifetimeRevenue(),
    ]);

    const data = {
      period,
      generatedAt: new Date().toISOString(),
      totals: {
        totalTransactions: contractStats.summary.totalTxns,
        totalTokenTransfers: contractStats.contracts.reduce(
          (sum, row) => sum + (row.tokenTransfers ?? 0),
          0,
        ),
        totalGames: metrics.totalGames,
        totalTrades: metrics.totalTrades,
        totalPlayHistoryEvents: metrics.totalPlayHistoryEvents,
        totalPropertiesOwned: metrics.totalPropertiesOwned,
      },
      engagement: {
        totalPlayers: metrics.totalPlayers,
        uniquePlayers: engagement.uniquePlayers,
        gamesPerPlayer: engagement.gamesPerPlayer,
        mostActivePlayer: engagement.mostActivePlayer,
        /** Lifetime stablecoin inflows (shop sales + tip packs). Not treasury balance. */
        perkShopRevenueUsdt: perkRevenue.perkShopRevenueUsdt,
        perkShopRevenueTotalStableUsd: perkRevenue.totalStableUsd,
        perkShopRevenueByCurrency: perkRevenue.byCurrency,
        perkShopTreasuryBalanceUsdt: perkRevenue.treasuryBalanceUsdt,
        perkShopRevenueMethod: perkRevenue.method,
      },
    };

    await redis.setJSON(cacheKey, data, CACHE_TTL_SECONDS);

    res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, "public stats error");
    res.status(500).json({ success: false, error: "Failed to load public stats" });
  }
}
