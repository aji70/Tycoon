import crypto from "crypto";
import db from "../config/database.js";

function generateCode() {
  return crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 10).toUpperCase();
}

const Tournament = {
  async create(data) {
    let code = (data && data.code) ? String(data.code).trim().toUpperCase() : generateCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db("tournaments").where({ code }).first();
      if (!existing) break;
      code = generateCode();
      attempts += 1;
    }
    const { code: _c, ...rest } = data || {};
    await db("tournaments").insert({ ...rest, code });
    const created = await this.findByCode(code);
    if (!created) throw new Error("Tournament create: failed to read back created row");
    return created;
  },

  async findById(id) {
    return db("tournaments").where({ id }).first();
  },

  async findByCode(code) {
    return db("tournaments").where({ code }).first();
  },

  /** Resolve by id (number) or code (string). */
  async findByIdOrCode(idOrCode) {
    if (idOrCode == null || String(idOrCode).trim() === "") return null;
    const s = String(idOrCode).trim();
    const num = Number(s);
    if (!Number.isNaN(num) && String(num) === s) {
      return this.findById(num);
    }
    return this.findByCode(s.toUpperCase());
  },

  async findAll({ limit = 50, offset = 0, status = null, chain = null, prize_source = null } = {}) {
    const query = db("tournaments")
      .select(
        "tournaments.*",
        db.raw("(SELECT COUNT(*) FROM tournament_entries WHERE tournament_entries.tournament_id = tournaments.id) AS participant_count")
      )
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset);
    if (status) query.where("tournaments.status", status);
    if (chain) query.where("tournaments.chain", chain);
    if (prize_source) query.where("tournaments.prize_source", prize_source);
    const rows = await query;
    return rows.map((r) => ({
      ...r,
      participant_count: r.participant_count != null ? Number(r.participant_count) : 0,
    }));
  },

  async update(id, data) {
    await db("tournaments").where({ id }).update({ ...data, updated_at: db.fn.now() });
    return this.findById(id);
  },

  /**
   * Delete a tournament and all related rows in dependency order to satisfy FKs.
   * tournament_matches references tournament_entries (no CASCADE), so we must delete
   * match_start_requests → matches → rounds → entries → tournament.
   */
  async delete(id) {
    const tournamentId = Number(id);
    if (!Number.isInteger(tournamentId)) return 0;

    return db.transaction(async (trx) => {
      const matchRows = await trx("tournament_matches")
        .where({ tournament_id: tournamentId })
        .select("id");
      const matchIds = matchRows.map((r) => r.id);

      if (matchIds.length > 0) {
        await trx("tournament_match_start_requests").whereIn("match_id", matchIds).del();
      }
      await trx("tournament_matches").where({ tournament_id: tournamentId }).del();
      await trx("tournament_rounds").where({ tournament_id: tournamentId }).del();
      await trx("tournament_entries").where({ tournament_id: tournamentId }).del();
      const deleted = await trx("tournaments").where({ id: tournamentId }).del();
      return deleted;
    });
  },
};

export default Tournament;
