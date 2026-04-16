import db from "../config/database.js";
import logger from "../config/logger.js";
import User from "../models/User.js";
import { getUserPropertyStats } from "../utils/userPropertyStats.js";
import { appendAdminAuditLog } from "../services/adminAuditLog.js";

const SENSITIVE_USER_KEYS = new Set([
  "password_hash",
  "password_hash_email",
  "withdrawal_pin_hash",
  "email_verification_token",
]);

function sanitizeUserRow(row) {
  if (!row || typeof row !== "object") return row;
  const out = { ...row };
  for (const k of SENSITIVE_USER_KEYS) delete out[k];
  return out;
}

const SORT_WHITELIST = {
  created_at_desc: [{ column: "users.created_at", direction: "desc" }],
  created_at_asc: [{ column: "users.created_at", direction: "asc" }],
  games_played_desc: [{ column: "users.games_played", direction: "desc" }],
  total_earned_desc: [{ column: "users.total_earned", direction: "desc" }],
  username_asc: [{ column: "users.username", direction: "asc" }],
};

function applyListFilters(queryBuilder, { q, chain }) {
  if (chain != null && String(chain).trim() !== "") {
    try {
      queryBuilder.where("users.chain", User.normalizeChain(chain));
    } catch (_) {
      queryBuilder.where("users.chain", String(chain).trim().toUpperCase());
    }
  }
  const search = q != null ? String(q).trim() : "";
  if (!search) return;
  const pat = `%${search.toLowerCase()}%`;
  queryBuilder.where(function () {
    this.whereRaw("(LOWER(users.username) LIKE ? OR LOWER(users.address) LIKE ?)", [pat, pat]);
    if (/^\d+$/.test(search)) {
      this.orWhere("users.id", Number(search));
    }
  });
}

/**
 * GET /api/admin/players
 * Query: page, pageSize, q, sort, chain
 */
export async function listPlayers(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const sortKey = SORT_WHITELIST[req.query.sort] ? req.query.sort : "created_at_desc";
    const orderSpecs = SORT_WHITELIST[sortKey];

    const filters = { q: req.query.q, chain: req.query.chain };

    const countQuery = db("users");
    applyListFilters(countQuery, filters);
    const countRow = await countQuery.count("* as c").first();
    const total = Number(countRow?.c ?? 0);

    let listQuery = db("users").select(
      "users.id",
      "users.username",
      "users.address",
      "users.chain",
      "users.is_guest",
      "users.games_played",
      "users.game_won",
      "users.game_lost",
      "users.total_earned",
      "users.created_at",
      "users.updated_at",
      "users.account_status"
    );
    applyListFilters(listQuery, filters);
    for (const { column, direction } of orderSpecs) {
      listQuery = listQuery.orderBy(column, direction);
    }
    listQuery = listQuery.orderBy("users.id", "desc").offset((page - 1) * pageSize).limit(pageSize);

    const players = await listQuery;

    res.json({
      success: true,
      data: {
        players: players.map((p) => ({
          id: p.id,
          username: p.username,
          address: p.address,
          chain: p.chain,
          is_guest: p.is_guest,
          games_played: Number(p.games_played ?? 0),
          game_won: Number(p.game_won ?? 0),
          game_lost: Number(p.game_lost ?? 0),
          total_earned: Number(p.total_earned ?? 0),
          created_at: p.created_at,
          updated_at: p.updated_at,
          status: String(p.account_status || "active").toLowerCase(),
        })),
        total,
        page,
        pageSize,
        sort: sortKey,
      },
    });
  } catch (err) {
    logger.error({ err }, "admin listPlayers error");
    res.status(500).json({ success: false, error: "Failed to list players" });
  }
}

/**
 * GET /api/admin/players/:id
 */
export async function getPlayerById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid player id" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: "Player not found" });
    }

    const propertyStats = await getUserPropertyStats(id);

    const gamesPlayedCountRow = await db("game_players").where({ user_id: id }).count("* as c").first();
    const gamesPlayedCount = Number(gamesPlayedCountRow?.c ?? 0);

    const recentGames = await db("game_players as gp")
      .join("games as g", "g.id", "gp.game_id")
      .where("gp.user_id", id)
      .select(
        "g.id as game_id",
        "g.code",
        "g.status",
        "g.mode",
        "g.chain",
        "g.is_ai",
        "g.winner_id",
        "g.created_at as game_created_at",
        "g.updated_at as game_updated_at",
        "gp.id as game_player_id",
        "gp.balance"
      )
      .orderBy("g.updated_at", "desc")
      .limit(50);

    const profile = sanitizeUserRow(user);

    let referral = null;
    try {
      const referralsCountRow = await db("users").where({ referred_by_user_id: id }).count("* as c").first();
      let referrerUsername = null;
      if (user.referred_by_user_id) {
        const ref = await db("users").where({ id: user.referred_by_user_id }).first("username");
        referrerUsername = ref?.username ?? null;
      }
      referral = {
        code: user.referral_code ?? null,
        referredByUserId: user.referred_by_user_id ?? null,
        referredAt: user.referred_at ?? null,
        referrerUsername,
        directReferralsCount: Number(referralsCountRow?.c ?? 0),
      };
    } catch (_) {
      referral = null;
    }

    res.json({
      success: true,
      data: {
        profile,
        referral,
        propertyStats: propertyStats ?? {
          properties_bought: 0,
          properties_sold: 0,
          trades_initiated: 0,
          trades_accepted: 0,
          favourite_property: null,
        },
        activity: {
          gameMembershipsCount: gamesPlayedCount,
          recentGames: recentGames.map((r) => ({
            gameId: r.game_id,
            code: r.code,
            status: r.status,
            mode: r.mode,
            chain: r.chain,
            isAi: !!r.is_ai,
            winnerId: r.winner_id,
            gamePlayerId: r.game_player_id,
            balance: r.balance,
            createdAt: r.game_created_at,
            updatedAt: r.game_updated_at,
            won: r.winner_id != null && Number(r.winner_id) === id,
          })),
        },
      },
    });
  } catch (err) {
    logger.error({ err }, "admin getPlayerById error");
    res.status(500).json({ success: false, error: "Failed to load player" });
  }
}

const ACCOUNT_STATUSES = new Set(["active", "suspended", "banned"]);

/**
 * PATCH /api/admin/players/:id/status
 * Body: { status: "active"|"suspended"|"banned", reason?: string }
 */
export async function patchPlayerStatus(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid player id" });
    }
    const status = String(req.body?.status ?? "").trim().toLowerCase();
    if (!ACCOUNT_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status (use active, suspended, or banned)",
      });
    }
    const reason = req.body?.reason != null ? String(req.body.reason).slice(0, 500) : "";

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: "Player not found" });
    }

    const prev = String(user.account_status || "active").toLowerCase();
    await db("users").where({ id }).update({ account_status: status, updated_at: new Date() });

    await appendAdminAuditLog({
      action: "players.status",
      targetType: "user",
      targetId: String(id),
      payload: {
        username: user.username,
        previousStatus: prev,
        nextStatus: status,
        reason: reason || null,
      },
      req,
    });

    res.json({
      success: true,
      data: { id, account_status: status, previousStatus: prev },
    });
  } catch (err) {
    logger.error({ err }, "admin patchPlayerStatus error");
    res.status(500).json({ success: false, error: "Failed to update player status" });
  }
}
