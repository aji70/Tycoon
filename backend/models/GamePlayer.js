import db from "../config/database.js";

const GamePlayer = {
  async join(data) {
    return db.transaction(async (trx) => {
      // 1. Ensure symbol uniqueness
      if (data.symbol) {
        const existing = await trx("game_players")
          .where({ game_id: data.game_id, symbol: data.symbol })
          .first();

        if (existing) {
          throw new Error(
            `Symbol "${data.symbol}" is already taken in this game.`
          );
        }
      }

      // 2. Auto-assign turn_order if missing
      if (!data.turn_order) {
        const maxTurn = await trx("game_players")
          .where({ game_id: data.game_id })
          .max("turn_order as maxOrder")
          .first();

        data.turn_order = (maxTurn.maxOrder || 0) + 1;
      }

      // 3. Insert player
      const [id] = await trx("game_players").insert(data);
      return this.findById(id, trx);
    });
  },

  async create(data) {
    const [id] = await db("game_players").insert(data);
    return this.findById(id);
  },

  async findById(id, trx = db) {
    return trx("game_players as gp")
      .leftJoin("users as u", "gp.user_id", "u.id")
      .leftJoin("games as g", "gp.game_id", "g.id")
      .select(
        "gp.*",
        "u.username",
        "u.address as user_address",
        "g.code as game_code"
      )
      .where("gp.id", id)
      .first();
  },

  async findAll({ limit = 100, offset = 0 } = {}) {
    return db("game_players as gp")
      .leftJoin("users as u", "gp.user_id", "u.id")
      .leftJoin("games as g", "gp.game_id", "g.id")
      .select("gp.*", "u.username", "g.code as game_code")
      .limit(limit)
      .offset(offset)
      .orderBy("gp.created_at", "desc");
  },

  async findByUserIdAndGameId(user_id, game_id) {
    return db("game_players")
      .select("*")
      .where("user_id", user_id)
      .where("game_id", game_id)
      .orderBy("id", "desc")
      .first();
  },

  async findByGameId(gameId) {
    return db("game_players as gp")
      .leftJoin("users as u", "gp.user_id", "u.id")
      .leftJoin("games as g", "gp.game_id", "g.id")
      .select(
        "gp.user_id",
        "gp.address",
        "gp.chance_jail_card",
        "gp.community_chest_jail_card",
        "gp.balance",
        "gp.position",
        "gp.turn_order",
        "gp.symbol",
        "gp.rolls",
        "gp.circle",
        "gp.created_at as joined_date",
        "u.username"
      )
      .where("gp.game_id", gameId)
      .orderBy("gp.turn_order", "asc");
  },

  async findByUserId(userId) {
    return db("game_players as gp")
      .leftJoin("games as g", "gp.game_id", "g.id")
      .select("gp.*", "g.code as game_code", "g.status as game_status")
      .where("gp.user_id", userId)
      .orderBy("gp.created_at", "desc");
  },

  async update(id, data) {
    return db.transaction(async (trx) => {
      // Prevent duplicate symbol when updating
      if (data.symbol) {
        const current = await trx("game_players").where({ id }).first();

        const conflict = await trx("game_players")
          .where({ game_id: current.game_id, symbol: data.symbol })
          .whereNot({ id })
          .first();

        if (conflict) {
          throw new Error(
            `Symbol "${data.symbol}" is already taken in this game.`
          );
        }
      }

      await trx("game_players")
        .where({ id })
        .update({ ...data, updated_at: db.fn.now() });

      return this.findById(id, trx);
    });
  },

  async delete(id) {
    return db("game_players").where({ id }).del();
  },

  async leave(game_id, user_id) {
    return db("game_players").where({ game_id, user_id }).del();
  },
};

export default GamePlayer;
