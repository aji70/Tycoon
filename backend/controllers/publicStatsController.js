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

/** Perk shop revenue = USDT balance held by the reward contract. Best-effort — null if the chain read fails. */
async function loadPerkShopRevenueUsdt() {
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
 * GET /api/public/stats
 * Query: period=all|day|week|month
 *
 * Heavy aggregate counts — served from Redis (short TTL) so anonymous polling
 * never fans out into full-table COUNT(*) scans on every request.
 */
export async function getPublicStats(req, res) {
  try {
    const periodParam = String(req.query.period || "all").toLowerCase();
    const cacheKey = `public:stats:${periodParam}`;

    const cached = await redis.getJSON(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const { metrics, period } = await loadOverviewMetrics(req.query.period);
    const contractStats = await getContractTxStats({ period });
    const [engagement, perkShopRevenueUsdt] = await Promise.all([
      loadPlayerEngagement(),
      loadPerkShopRevenueUsdt(),
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
        perkShopRevenueUsdt,
      },
    };

    await redis.setJSON(cacheKey, data, CACHE_TTL_SECONDS);

    res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, "public stats error");
    res.status(500).json({ success: false, error: "Failed to load public stats" });
  }
}
