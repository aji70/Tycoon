import db from "../config/database.js";

const TournamentRound = {
  async create(data) {
    const [id] = await db("tournament_rounds").insert(data);
    return this.findById(id);
  },

  async findById(id) {
    return db("tournament_rounds").where({ id }).first();
  },

  async findByTournament(tournamentId) {
    return db("tournament_rounds").where({ tournament_id: tournamentId }).orderBy("round_index", "asc");
  },

  async findByTournamentAndIndex(tournamentId, roundIndex) {
    return db("tournament_rounds").where({ tournament_id: tournamentId, round_index: roundIndex }).first();
  },

  async update(id, data) {
    await db("tournament_rounds").where({ id }).update({ ...data, updated_at: db.fn.now() });
    return this.findById(id);
  },
};

export default TournamentRound;
