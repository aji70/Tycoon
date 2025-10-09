import db from "../config/database.js";

/**
 * GamePlayHistory Model
 *
 * Encapsulates DB operations for the `game_play_history` table.
 */
const GamePlayHistory = {
  // -------------------------
  // 🔹 CREATE
  // -------------------------
  async create(data) {
    const [id] = await db("game_play_history").insert(data);
    return this.findById(id);
  },

  // -------------------------
  // 🔹 READ
  // -------------------------
  async findById(id) {
    return db("game_play_history as h")
      .leftJoin("games as g", "h.game_id", "g.id")
      .leftJoin("game_players as gp", "h.game_player_id", "gp.id")
      .leftJoin("users as u", "gp.user_id", "u.id")
      .select(
        "h.*",
        "g.code as game_code",
        "gp.symbol as player_symbol",
        "u.username as player_name"
      )
      .where("h.id", id)
      .first();
  },

  async findAll({ limit = 100, offset = 0 } = {}) {
    return db("game_play_history as h")
      .leftJoin("games as g", "h.game_id", "g.id")
      .leftJoin("game_players as gp", "h.game_player_id", "gp.id")
      .leftJoin("users as u", "gp.user_id", "u.id")
      .select(
        "h.*",
        "g.code as game_code",
        "gp.symbol as player_symbol",
        "u.username as player_name"
      )
      .limit(limit)
      .offset(offset)
      .orderBy("h.created_at", "desc");
  },

  async findByGameId(gameId, { limit = 200, offset = 0 } = {}) {
    return db("game_play_history as h")
      .leftJoin("game_players as gp", "h.game_player_id", "gp.id")
      .leftJoin("users as u", "gp.user_id", "u.id")
      .select("h.*", "gp.symbol as player_symbol", "u.username as player_name")
      .where("h.game_id", gameId)
      .limit(limit)
      .offset(offset)
      .orderBy("h.created_at", "asc"); // chronological order
  },

  async findByPlayerId(gamePlayerId, { limit = 100, offset = 0 } = {}) {
    return db("game_play_history as h")
      .leftJoin("game_players as gp", "h.game_player_id", "gp.id")
      .leftJoin("users as u", "gp.user_id", "u.id")
      .select("h.*", "gp.symbol as player_symbol", "u.username as player_name")
      .where("h.game_player_id", gamePlayerId)
      .limit(limit)
      .offset(offset)
      .orderBy("h.created_at", "asc");
  },

  // -------------------------
  // 🔹 UPDATE
  // -------------------------
  async update(id, data) {
    await db("game_play_history")
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() });
    return this.findById(id);
  },

  // -------------------------
  // 🔹 DELETE
  // -------------------------
  async delete(id) {
    return db("game_play_history").where({ id }).del();
  },
  
  async findLatestActiveByGameId(game_id) {
    return await db("game_play_history")
      .where({ game_id, active: 1 })
      .orderBy("id", "desc")
      .first();
  },
};

export default GamePlayHistory;
