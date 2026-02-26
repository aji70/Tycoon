import db from "../config/database.js";

const TournamentEntry = {
  async create(data) {
    const [id] = await db("tournament_entries").insert(data);
    return this.findById(id);
  },

  async findById(id) {
    return db("tournament_entries").where({ id }).first();
  },

  async findByTournament(tournamentId, { withUser = false } = {}) {
    const query = db("tournament_entries").where({ tournament_id: tournamentId }).orderBy("seed_order", "asc").orderBy("id", "asc");
    if (withUser) {
      return query.select("tournament_entries.*", "users.username", "users.address as user_address").join("users", "tournament_entries.user_id", "users.id");
    }
    return query;
  },

  async findByTournamentAndUser(tournamentId, userId) {
    return db("tournament_entries").where({ tournament_id: tournamentId, user_id: userId }).first();
  },

  /** Check if this address (or linked_wallet) already has an entry in this tournament (any user_id). */
  async findByTournamentAndAddress(tournamentId, address) {
    if (!address || !tournamentId) return null;
    const normalized = String(address).trim().toLowerCase();
    return db("tournament_entries")
      .where({ tournament_id: tournamentId })
      .whereRaw("LOWER(TRIM(address)) = ?", [normalized])
      .first();
  },

  /** For duplicate check: entry by user_id or by address in this tournament */
  async hasEntry(tournamentId, { userId, address } = {}) {
    if (userId) {
      const byUser = await this.findByTournamentAndUser(tournamentId, userId);
      if (byUser) return true;
    }
    if (address) {
      const byAddr = await this.findByTournamentAndAddress(tournamentId, address);
      if (byAddr) return true;
    }
    return false;
  },

  async update(id, data) {
    await db("tournament_entries").where({ id }).update({ ...data, updated_at: db.fn.now() });
    return this.findById(id);
  },

  async countByTournament(tournamentId) {
    const r = await db("tournament_entries").where({ tournament_id: tournamentId }).count("* as count").first();
    return Number(r?.count ?? 0);
  },
};

export default TournamentEntry;
