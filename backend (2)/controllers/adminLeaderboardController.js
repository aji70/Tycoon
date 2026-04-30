import db from "../config/database.js";
import logger from "../config/logger.js";
import User from "../models/User.js";

const PERIODS = new Set(["daily", "weekly", "monthly", "all"]);

function periodStartDate(period) {
  const now = Date.now();
  if (period === "daily") return new Date(now - 24 * 60 * 60 * 1000);
  if (period === "weekly") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (period === "monthly") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return null;
}

/**
 * GET /api/admin/leaderboard
 * Query: period=daily|weekly|monthly|all, chain=CELO|..., limit=1-100, includeNullChain=true|false
 *        source=games|profile (profile = User.getLeaderboardByWins; only meaningful with period=all)
 *
 * Games source: counts FINISHED games with winner_id, optional date window on updated_at.
 */
export async function getLeaderboard(req, res) {
  try {
    const period = String(req.query.period || "all").toLowerCase();
    if (!PERIODS.has(period)) {
      return res.status(400).json({
        success: false,
        error: "Invalid period (use daily, weekly, monthly, all)",
      });
    }

    const chainNorm = User.normalizeChain(req.query.chain || "CELO");
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const source = String(req.query.source || "games").toLowerCase();
    const includeNullChain = req.query.includeNullChain !== "false";

    if (source === "profile") {
      if (period !== "all") {
        return res.status(400).json({
          success: false,
          error: 'source=profile only supports period=all (uses user table columns)',
        });
      }
      const rows = await User.getLeaderboardByWins(chainNorm, limit);
      const leaderboard = (rows || []).map((row, i) => ({
        rank: i + 1,
        userId: row.id,
        username: row.username ?? null,
        address: row.address ?? null,
        gamesPlayed: Number(row.games_played ?? 0),
        wins: Number(row.game_won ?? 0),
      }));
      return res.json({
        success: true,
        data: {
          period: "all",
          chain: chainNorm,
          limit,
          source: "profile",
          leaderboard,
        },
      });
    }

    if (source !== "games") {
      return res.status(400).json({ success: false, error: "Invalid source (games or profile)" });
    }

    const start = periodStartDate(period);

    let qb = db("games")
      .where({ status: "FINISHED" })
      .whereNotNull("winner_id");

    if (start) {
      qb = qb.where("updated_at", ">=", start);
    }

    qb = qb.where(function () {
      this.where("chain", chainNorm);
      if (includeNullChain) {
        this.orWhereNull("chain").orWhere("chain", "");
      }
    });

    const winRows = await qb
      .select("winner_id")
      .count("* as wins")
      .groupBy("winner_id")
      .orderBy("wins", "desc")
      .limit(limit);

    const userIds = winRows.map((r) => Number(r.winner_id)).filter((id) => Number.isFinite(id) && id > 0);
    let userMap = {};
    if (userIds.length) {
      const users = await db("users").whereIn("id", userIds).select("id", "username", "address");
      userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    }

    const leaderboard = winRows.map((r, i) => {
      const uid = Number(r.winner_id);
      const u = userMap[uid];
      return {
        rank: i + 1,
        userId: uid,
        wins: Number(r.wins ?? 0),
        username: u?.username ?? null,
        address: u?.address ?? null,
      };
    });

    res.json({
      success: true,
      data: {
        period,
        chain: chainNorm,
        limit,
        source: "games",
        includeNullChain,
        windowStart: start ? start.toISOString() : null,
        leaderboard,
      },
    });
  } catch (err) {
    logger.error({ err }, "admin getLeaderboard error");
    res.status(500).json({ success: false, error: "Failed to load leaderboard" });
  }
}
