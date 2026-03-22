import db from "../config/database.js";

/**
 * Knex + mysql2 treat JS arrays in insert bindings as multiple VALUES (e.g. [a,b] → two columns).
 * JSON columns must be a single binding — stringify arrays for `participant_entry_ids`.
 */
function normalizeMatchInsertRow(row) {
  if (!row || typeof row !== "object") return row;
  const out = { ...row };
  if (Array.isArray(out.participant_entry_ids)) {
    out.participant_entry_ids = JSON.stringify(out.participant_entry_ids);
  }
  if (Array.isArray(out.advancing_entry_ids)) {
    out.advancing_entry_ids = JSON.stringify(out.advancing_entry_ids);
  }
  if (Array.isArray(out.finish_standings)) {
    out.finish_standings = JSON.stringify(out.finish_standings);
  }
  return out;
}

const TournamentMatch = {
  async create(data) {
    const [id] = await db("tournament_matches").insert(normalizeMatchInsertRow(data));
    return this.findById(id);
  },

  /** Insert many matches in one query. Use for bracket generation. */
  async bulkCreate(rows) {
    if (!rows || rows.length === 0) return;
    await db("tournament_matches").insert(rows.map(normalizeMatchInsertRow));
  },

  async findById(id) {
    return db("tournament_matches").where({ id }).first();
  },

  async findByTournament(tournamentId) {
    return db("tournament_matches")
      .where({ tournament_id: tournamentId })
      .orderBy("round_index", "asc")
      .orderBy("match_index", "asc");
  },

  async findByTournamentAndRound(tournamentId, roundIndex) {
    return db("tournament_matches")
      .where({ tournament_id: tournamentId, round_index: roundIndex })
      .orderBy("match_index", "asc");
  },

  async findByGameId(gameId) {
    return db("tournament_matches").where({ game_id: gameId }).first();
  },

  async update(id, data) {
    const row = normalizeMatchInsertRow({ ...data });
    await db("tournament_matches").where({ id }).update({ ...row, updated_at: db.fn.now() });
    return this.findById(id);
  },
};

export default TournamentMatch;
