import db from "../config/database.js";

const TournamentMatch = {
  async create(data) {
    const [id] = await db("tournament_matches").insert(data);
    return this.findById(id);
  },

  /** Insert many matches in one query. Use for bracket generation. */
  async bulkCreate(rows) {
    if (!rows || rows.length === 0) return;
    await db("tournament_matches").insert(rows);
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
    await db("tournament_matches").where({ id }).update({ ...data, updated_at: db.fn.now() });
    return this.findById(id);
  },
};

export default TournamentMatch;
