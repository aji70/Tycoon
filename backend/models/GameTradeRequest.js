import db from "../config/database.js";

const TABLE = "game_trade_requests";

export default {
  // ✅ Create new trade request
  async create(data) {
    const [id] = await db(TABLE).insert({
      game_id: data.game_id,
      player_id: data.player_id,
      target_player_id: data.target_player_id,
      offer_properties: JSON.stringify(data.offer_properties || []),
      offer_amount: data.offer_amount || 0,
      requested_properties: JSON.stringify(data.requested_properties || []),
      requested_amount: data.requested_amount || 0,
      status: data.status || "pending",
    });

    return this.getById(id);
  },

  // ✅ Get by ID
  async getById(id) {
    const record = await db(TABLE).where({ id }).first();
    return record ? this._parseJsonFields(record) : null;
  },

  // ✅ Update trade request
  async update(id, updates) {
    await db(TABLE)
      .where({ id })
      .update({
        ...updates,
        offer_properties: updates.offer_properties
          ? JSON.stringify(updates.offer_properties)
          : undefined,
        requested_properties: updates.requested_properties
          ? JSON.stringify(updates.requested_properties)
          : undefined,
        updated_at: db.fn.now(),
      });
    return this.getById(id);
  },

  // ✅ Delete trade request
  async delete(id) {
    return db(TABLE).where({ id }).del();
  },

  // ✅ Get all trade requests for a given game
  async getByGameId(game_id) {
    const records = await db(TABLE).where({ game_id });
    return records.map(this._parseJsonFields);
  },

  // ✅ Get all trades involving a specific player (as initiator or target)
  async getByPlayer(game_id, player_id) {
    const records = await db(TABLE)
      .where({ game_id })
      .andWhere(function () {
        this.where("player_id", player_id).orWhere(
          "target_player_id",
          player_id
        );
      });
    return records.map(this._parseJsonFields);
  },

  // ✅ Get all trades for a game with a specific status
  async getByStatus(game_id, status) {
    const records = await db(TABLE).where({ game_id, status });
    return records.map(this._parseJsonFields);
  },

  // ✅ Helper: parse JSON fields
  _parseJsonFields(record) {
    return {
      ...record,
      offer_properties: record.offer_properties
        ? JSON.parse(record.offer_properties)
        : [],
      requested_properties: record.requested_properties
        ? JSON.parse(record.requested_properties)
        : [],
    };
  },
};
