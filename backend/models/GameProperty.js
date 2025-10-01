import db from "../config/database.js";

const GameProperty = {
  // -------------------------
  // 🔹 CREATE
  // -------------------------
  async create(data) {
    // Rule 1: Property can’t belong to multiple players in the same game
    const exists = await db("game_properties")
      .where({ game_id: data.game_id, property_id: data.property_id })
      .first();

    if (exists) {
      throw new Error("This property is already owned in this game");
    }

    const [id] = await db("game_properties").insert(data);
    return this.findById(id);
  },

  // -------------------------
  // 🔹 READ
  // -------------------------
  async findById(id) {
    return db("game_properties as gp")
      .leftJoin("games as g", "gp.game_id", "g.id")
      .leftJoin("game_players as p", "gp.player_id", "p.id")
      .leftJoin("users as u", "p.user_id", "u.id")
      .leftJoin("properties as pr", "gp.property_id", "pr.id")
      .select(
        "gp.*",
        "g.code as game_code",
        "p.symbol as player_symbol",
        "u.username as player_username",
        "pr.name as property_name"
      )
      .where("gp.id", id)
      .first();
  },

  async findAll({ limit = 100, offset = 0 } = {}) {
    return db("game_properties as gp")
      .leftJoin("properties as pr", "gp.property_id", "pr.id")
      .leftJoin("game_players as p", "gp.player_id", "p.id")
      .leftJoin("users as u", "p.user_id", "u.id")
      .select(
        "gp.*",
        "pr.name as property_name",
        "u.username as player_username"
      )
      .limit(limit)
      .offset(offset)
      .orderBy("gp.created_at", "desc");
  },

  async findByGameId(gameId) {
    return db("game_properties as gp")
      .leftJoin("properties as pr", "gp.property_id", "pr.id")
      .leftJoin("game_players as p", "gp.player_id", "p.id")
      .leftJoin("users as u", "p.user_id", "u.id")
      .select("gp.*", "u.address as address")
      .where("gp.game_id", gameId)
      .orderBy("gp.created_at", "asc");
  },

  async findByPlayerId(playerId) {
    return db("game_properties as gp")
      .leftJoin("properties as pr", "gp.property_id", "pr.id")
      .leftJoin("game_players as p", "gp.player_id", "p.id")
      .leftJoin("users as u", "p.user_id", "u.id")
      .select("gp.*", "u.address as address")
      .where("gp.player_id", playerId)
      .orderBy("gp.created_at", "desc");
  },

  // -------------------------
  // 🔹 UPDATE
  // -------------------------
  async update(id, data) {
    await db("game_properties")
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() });
    return this.findById(id);
  },

  // -------------------------
  // 🔹 DELETE
  // -------------------------
  async delete(id) {
    return db("game_properties").where({ id }).del();
  },
};

export default GameProperty;
