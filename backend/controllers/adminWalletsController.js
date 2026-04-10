import db from "../config/database.js";
import logger from "../config/logger.js";
import User from "../models/User.js";

function applyWalletFilters(qb, { q, chainFilter }) {
  if (chainFilter) {
    try {
      qb.where("u.chain", User.normalizeChain(chainFilter));
    } catch (_) {
      qb.where("u.chain", String(chainFilter).trim().toUpperCase());
    }
  }
  const search = q != null ? String(q).trim() : "";
  if (!search) return;
  const pat = `%${search.toLowerCase()}%`;
  qb.where(function () {
    this.whereRaw(
      "(LOWER(u.username) LIKE ? OR LOWER(u.address) LIKE ? OR LOWER(COALESCE(u.smart_wallet_address,'')) LIKE ? OR LOWER(COALESCE(u.linked_wallet_address,'')) LIKE ?)",
      [pat, pat, pat, pat]
    );
    if (/^\d+$/.test(search)) {
      this.orWhere("u.id", Number(search));
    }
  });
}

/**
 * GET /api/admin/wallets
 * Paginated user rows for wallet monitoring (no on-chain balance reads here).
 * Query: page, pageSize, q (username / address / id), chain, sort=updated_desc|created_desc
 */
export async function listWallets(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 40));
    const q = req.query.q != null ? String(req.query.q).trim() : "";
    const chainFilter = req.query.chain != null ? String(req.query.chain).trim() : "";
    const sort = String(req.query.sort || "updated_desc").toLowerCase();

    const filters = { q, chainFilter };

    const countQuery = db("users as u");
    applyWalletFilters(countQuery, filters);
    const countRow = await countQuery.count("* as c").first();
    const total = Number(countRow?.c ?? 0);

    let listQ = db("users as u").select(
      "u.id",
      "u.username",
      "u.address",
      "u.chain",
      "u.is_guest",
      "u.smart_wallet_address",
      "u.linked_wallet_address",
      "u.games_played",
      "u.game_won",
      "u.total_earned",
      "u.created_at",
      "u.updated_at"
    );
    applyWalletFilters(listQ, filters);

    if (sort === "created_desc") {
      listQ = listQ.orderBy("u.created_at", "desc");
    } else {
      listQ = listQ.orderBy("u.updated_at", "desc");
    }
    listQ = listQ.orderBy("u.id", "desc").offset((page - 1) * pageSize).limit(pageSize);

    const rows = await listQ;

    const wallets = rows.map((u) => ({
      userId: u.id,
      username: u.username,
      primaryAddress: u.address,
      chain: u.chain,
      isGuest: !!u.is_guest,
      smartWalletAddress: u.smart_wallet_address || null,
      linkedWalletAddress: u.linked_wallet_address || null,
      gamesPlayed: Number(u.games_played ?? 0),
      gamesWon: Number(u.game_won ?? 0),
      totalEarned: Number(u.total_earned ?? 0),
      status: "active",
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    }));

    res.json({
      success: true,
      data: { wallets, total, page, pageSize, sort },
    });
  } catch (err) {
    logger.error({ err }, "admin listWallets error");
    res.status(500).json({ success: false, error: "Failed to list wallets" });
  }
}
