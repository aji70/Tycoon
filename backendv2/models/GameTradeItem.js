import db from "../config/database.js";

const GameTradeItem = {
  // -------------------------
  // 🔹 CREATE
  // -------------------------
  async create(data) {
    // Rule 1: Ensure property not already in this trade
    const exists = await db("game_trade_items")
      .where({ trade_id: data.trade_id, property_id: data.property_id })
      .first();
    if (exists) {
      throw new Error("This property is already included in the trade");
    }

    // Rule 2: Ensure property belongs to contributing player
    const ownership = await db("game_properties")
      .where({ property_id: data.property_id, player_id: data.player_id })
      .first();

    if (!ownership) {
      throw new Error("Player does not own this property to trade");
    }

    const [id] = await db("game_trade_items").insert(data);
    return this.findById(id);
  },

  // -------------------------
  // 🔹 READ
  // -------------------------
  async findById(id) {
    return db("game_trade_items as ti")
      .leftJoin("game_trades as t", "ti.trade_id", "t.id")
      .leftJoin("properties as p", "ti.property_id", "p.id")
      .leftJoin("game_players as gp", "ti.player_id", "gp.id")
      .leftJoin("users as u", "gp.user_id", "u.id")
      .select(
        "ti.*",
        "p.name as property_name",
        "gp.symbol as player_symbol",
        "u.username as player_username",
        "t.status as trade_status"
      )
      .where("ti.id", id)
      .first();
  },

  async findAll({ limit = 100, offset = 0 } = {}) {
    return db("game_trade_items as ti")
      .leftJoin("properties as p", "ti.property_id", "p.id")
      .leftJoin("game_players as gp", "ti.player_id", "gp.id")
      .leftJoin("users as u", "gp.user_id", "u.id")
      .select(
        "ti.*",
        "p.name as property_name",
        "u.username as player_username"
      )
      .limit(limit)
      .offset(offset)
      .orderBy("ti.created_at", "desc");
  },

  async findByTradeId(tradeId) {
    return db("game_trade_items as ti")
      .leftJoin("properties as p", "ti.property_id", "p.id")
      .leftJoin("game_players as gp", "ti.player_id", "gp.id")
      .leftJoin("users as u", "gp.user_id", "u.id")
      .select(
        "ti.*",
        "p.name as property_name",
        "u.username as player_username"
      )
      .where("ti.trade_id", tradeId)
      .orderBy("ti.created_at", "asc");
  },

  async findByPlayerId(playerId) {
    return db("game_trade_items as ti")
      .leftJoin("properties as p", "ti.property_id", "p.id")
      .select("ti.*", "p.name as property_name")
      .where("ti.player_id", playerId)
      .orderBy("ti.created_at", "desc");
  },

  // -------------------------
  // 🔹 DELETE
  // -------------------------
  async delete(id) {
    return db("game_trade_items").where({ id }).del();
  },

  async deleteByTrade(tradeId) {
    return db("game_trade_items").where({ trade_id: tradeId }).del();
  },
};

export default GameTradeItem;
