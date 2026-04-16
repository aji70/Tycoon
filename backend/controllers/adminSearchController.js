import db from "../config/database.js";
import logger from "../config/logger.js";

/**
 * GET /api/admin/search
 * Query: q (required, min 2 chars unless numeric id), limit (per category, default 8, max 15)
 * Returns matching players, games, board properties, and moderation reports (when tables exist).
 */
export async function search(req, res) {
  try {
    const raw = req.query.q != null ? String(req.query.q).trim() : "";
    if (raw.length === 0) {
      return res.json({
        success: true,
        data: { query: "", players: [], games: [], properties: [], reports: [], hint: null },
      });
    }

    const isNumeric = /^\d+$/.test(raw);
    if (raw.length < 2 && !isNumeric) {
      return res.json({
        success: true,
        data: {
          query: raw,
          players: [],
          games: [],
          properties: [],
          reports: [],
          hint: "Type at least 2 characters, or a numeric id for exact match.",
        },
      });
    }

    const limit = Math.min(15, Math.max(1, Number(req.query.limit) || 8));

    let playersQ = db("users")
      .select("id", "username", "address", "chain", "is_guest", "referral_code")
      .orderBy("id", "desc")
      .limit(limit);

    if (isNumeric) {
      const n = Number(raw);
      const lower = raw.toLowerCase();
      playersQ = playersQ.where(function () {
        this.where("id", n)
          .orWhereRaw("LOWER(username) LIKE ?", [`%${lower}%`])
          .orWhereRaw("LOWER(address) LIKE ?", [`%${lower}%`])
          .orWhereRaw("LOWER(COALESCE(referral_code, '')) LIKE ?", [`%${lower}%`]);
      });
    } else {
      const pat = `%${raw.toLowerCase()}%`;
      playersQ = playersQ.whereRaw(
        "(LOWER(username) LIKE ? OR LOWER(address) LIKE ? OR LOWER(COALESCE(referral_code, '')) LIKE ?)",
        [pat, pat, pat]
      );
    }

    let gamesQ = db("games")
      .select("id", "code", "status", "chain", "mode")
      .orderBy("id", "desc")
      .limit(limit);

    if (isNumeric) {
      const n = Number(raw);
      gamesQ = gamesQ.where(function () {
        this.where("id", n).orWhereRaw("UPPER(code) LIKE ?", [`%${raw.toUpperCase()}%`]);
      });
    } else {
      gamesQ = gamesQ.whereRaw("UPPER(code) LIKE ?", [`%${raw.toUpperCase()}%`]);
    }

    let propertiesQ = db("properties")
      .select("id", "name", "type", "position")
      .orderBy("id", "asc")
      .limit(limit);

    if (isNumeric) {
      const n = Number(raw);
      propertiesQ = propertiesQ.where(function () {
        this.where("id", n).orWhereRaw("LOWER(name) LIKE ?", [`%${raw.toLowerCase()}%`]);
      });
    } else {
      const pat = `%${raw.toLowerCase()}%`;
      propertiesQ = propertiesQ.whereRaw("LOWER(name) LIKE ?", [pat]);
    }

    let reports = [];
    try {
      let reportsQ = db("moderation_reports as mr")
        .leftJoin("users as target", "mr.target_user_id", "target.id")
        .select(
          "mr.id",
          "mr.status",
          "mr.category",
          "mr.created_at as createdAt",
          db.raw("target.username as targetUsername")
        )
        .orderBy("mr.id", "desc")
        .limit(limit);

      if (isNumeric) {
        const n = Number(raw);
        reportsQ = reportsQ.where(function () {
          this.where("mr.id", n)
            .orWhereRaw("LOWER(mr.category) LIKE ?", [`%${raw.toLowerCase()}%`])
            .orWhereRaw("LOWER(COALESCE(mr.details, '')) LIKE ?", [`%${raw.toLowerCase()}%`]);
        });
      } else {
        const pat = `%${raw.toLowerCase()}%`;
        reportsQ = reportsQ.where(function () {
          this.whereRaw("LOWER(mr.category) LIKE ?", [pat]).orWhereRaw("LOWER(COALESCE(mr.details, '')) LIKE ?", [pat]);
        });
      }
      reports = await reportsQ;
    } catch (err) {
      reports = [];
    }

    const [players, games] = await Promise.all([playersQ, gamesQ]);
    let properties = [];
    try {
      properties = await propertiesQ;
    } catch (err) {
      logger.warn({ err }, "admin search properties skipped");
    }

    res.json({
      success: true,
      data: {
        query: raw,
        players: players.map((p) => ({
          id: p.id,
          username: p.username,
          address: p.address,
          chain: p.chain,
          isGuest: !!p.is_guest,
          referralCode: p.referral_code ?? null,
        })),
        games: games.map((g) => ({
          id: g.id,
          code: g.code,
          status: g.status,
          chain: g.chain,
          mode: g.mode,
        })),
        properties: properties.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          position: p.position,
        })),
        reports: reports.map((r) => ({
          id: r.id,
          status: r.status,
          category: r.category,
          targetUsername: r.targetUsername ?? null,
          createdAt: r.createdAt,
        })),
        hint: null,
      },
    });
  } catch (err) {
    logger.error({ err }, "admin search error");
    res.status(500).json({ success: false, error: "Search failed" });
  }
}
