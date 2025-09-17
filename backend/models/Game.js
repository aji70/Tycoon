import db from "../config/database.js";
const Game = {
  // -------------------------
  // 🔹 CRUD
  // -------------------------

  async create(data) {
    const [id] = await db("games").insert(data);
    return this.findById(id);
  },

  async findById(id) {
    return db("games").where({ id }).first();
  },

  async findAll({ limit = 100, offset = 0 } = {}) {
    return db("games")
      .select("*")
      .limit(limit)
      .offset(offset)
      .orderBy("created_at", "desc");
  },

  async update(id, data) {
    await db("games")
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() });
    return this.findById(id);
  },

  async delete(id) {
    return db("games").where({ id }).del();
  },

  // -------------------------
  // 🔹 Extra Queries
  // -------------------------

  async findByCode(code) {
    return db("games").where({ code }).first();
  },

  async findByWinner(userId, { limit = 50, offset = 0 } = {}) {
    return db("games").where({ winner_id: userId }).limit(limit).offset(offset);
  },

  async findByCreator(userId, { limit = 50, offset = 0 } = {}) {
    return db("games")
      .where({ creator_id: userId })
      .limit(limit)
      .offset(offset);
  },

  async findPendingGames({ limit = 50, offset = 0 } = {}) {
    return db("games")
      .whereIn("status", ["PENDING"])
      .limit(limit)
      .offset(offset);
  },

  async findActiveGames({ limit = 50, offset = 0 } = {}) {
    return db("games")
      .whereIn("status", ["PENDING", "RUNNING"])
      .limit(limit)
      .offset(offset);
  },
};

export default Game;
