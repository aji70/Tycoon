import db from "../config/database.js";

const PlayerChallenge = {
  async create(data) {
    const [id] = await db("player_challenges").insert(data);
    return this.findById(id);
  },

  async findById(id) {
    return db("player_challenges").where({ id }).first();
  },

  async findPendingBetween(challengerId, opponentId) {
    return db("player_challenges")
      .where({
        challenger_id: challengerId,
        opponent_id: opponentId,
        status: "pending",
      })
      .orderBy("id", "desc")
      .first();
  },

  async listIncoming(userId, { limit = 20 } = {}) {
    return db("player_challenges as c")
      .leftJoin("users as u", "c.challenger_id", "u.id")
      .where({ "c.opponent_id": userId, "c.status": "pending" })
      .orderBy("c.id", "desc")
      .limit(Math.min(50, Math.max(1, Number(limit) || 20)))
      .select(
        "c.id",
        "c.challenger_id",
        "c.opponent_id",
        "c.game_id",
        "c.game_code",
        "c.status",
        "c.expires_at",
        "c.created_at",
        "u.username as challenger_username",
        "u.address as challenger_address"
      );
  },

  async listOutgoing(userId, { limit = 20 } = {}) {
    return db("player_challenges as c")
      .leftJoin("users as u", "c.opponent_id", "u.id")
      .where({ "c.challenger_id": userId, "c.status": "pending" })
      .orderBy("c.id", "desc")
      .limit(Math.min(50, Math.max(1, Number(limit) || 20)))
      .select(
        "c.id",
        "c.challenger_id",
        "c.opponent_id",
        "c.game_id",
        "c.game_code",
        "c.status",
        "c.expires_at",
        "c.created_at",
        "u.username as opponent_username",
        "u.address as opponent_address"
      );
  },

  async update(id, data) {
    await db("player_challenges")
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() });
    return this.findById(id);
  },
};

export default PlayerChallenge;
