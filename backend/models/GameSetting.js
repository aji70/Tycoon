import db from "../config/database.js";

const GameSetting = {
  // -------------------------
  // 🔹 CRUD
  // -------------------------

  async create(data) {
    const [id] = await db("game_settings").insert(data);
    return this.findById(id);
  },

  async findById(id) {
    return db("game_settings").where({ id }).first();
  },

  async findByGameId(gameId) {
    return db("game_settings")
      .select(
        "auction",
        "mortgage",
        "even_build",
        "randomize_play_order",
        "starting_cash"
      )
      .where({ game_id: gameId })
      .first();
  },

  async findAll({ limit = 100, offset = 0 } = {}) {
    return db("game_settings")
      .select("*")
      .limit(limit)
      .offset(offset)
      .orderBy("created_at", "desc");
  },

  async update(id, data) {
    await db("game_settings")
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() });
    return this.findById(id);
  },

  async updateByGameId(gameId, data) {
    await db("game_settings")
      .where({ game_id: gameId })
      .update({ ...data, updated_at: db.fn.now() });
    return this.findByGameId(gameId);
  },

  async delete(id) {
    return db("game_settings").where({ id }).del();
  },

  async deleteByGameId(gameId) {
    return db("game_settings").where({ game_id: gameId }).del();
  },
};

export default GameSetting;
