import db from "../config/database.js";
import logger from "../config/logger.js";

/**
 * GET /api/admin/search
 * Query: q (required, min 2 chars unless numeric id), limit (per category, default 8, max 15)
 * Returns matching players (username, address, id) and games (code, id).
 */
export async function search(req, res) {
  try {
    const raw = req.query.q != null ? String(req.query.q).trim() : "";
    if (raw.length === 0) {
      return res.json({
        success: true,
        data: { query: "", players: [], games: [], hint: null },
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
          hint: "Type at least 2 characters, or a numeric id for exact match.",
        },
      });
    }

    const limit = Math.min(15, Math.max(1, Number(req.query.limit) || 8));

    let playersQ = db("users")
      .select("id", "username", "address", "chain", "is_guest")
      .orderBy("id", "desc")
      .limit(limit);

    if (isNumeric) {
      const n = Number(raw);
      playersQ = playersQ.where(function () {
        this.where("id", n)
          .orWhereRaw("LOWER(username) LIKE ?", [`%${raw.toLowerCase()}%`])
          .orWhereRaw("LOWER(address) LIKE ?", [`%${raw.toLowerCase()}%`]);
      });
    } else {
      const pat = `%${raw.toLowerCase()}%`;
      playersQ = playersQ.whereRaw("(LOWER(username) LIKE ? OR LOWER(address) LIKE ?)", [pat, pat]);
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

    const [players, games] = await Promise.all([playersQ, gamesQ]);

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
        })),
        games: games.map((g) => ({
          id: g.id,
          code: g.code,
          status: g.status,
          chain: g.chain,
          mode: g.mode,
        })),
        hint: null,
      },
    });
  } catch (err) {
    logger.error({ err }, "admin search error");
    res.status(500).json({ success: false, error: "Search failed" });
  }
}
