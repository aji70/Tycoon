import db from "../config/database.js";

import { withTransaction } from "../utils/transaction-helper.js";
/**
 * GameTrade Model
 *
 * Encapsulates DB operations for the `game_trades` table.
 */

const VALID_TYPES = ["CASH", "PROPERTY", "MIXED"];
const VALID_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "COUNTERED"];

const GameTrade = {
  // -------------------------
  // 🔹 CREATE
  // -------------------------
  async create(data) {
    // Rule 1: Prevent trading with self
    if (data.from_player_id === data.to_player_id) {
      throw new Error("A player cannot trade with themselves");
    }

    // Rule 2: Validate enums
    if (!VALID_TYPES.includes(data.type)) {
      throw new Error(`Invalid trade type. Allowed: ${VALID_TYPES.join(", ")}`);
    }

    if (!VALID_STATUSES.includes(data.status)) {
      throw new Error(
        `Invalid trade status. Allowed: ${VALID_STATUSES.join(", ")}`
      );
    }

    // Rule 3: Ensure non-negative amounts
    if (data.sending_amount < 0 || data.receiving_amount < 0) {
      throw new Error("Trade amounts cannot be negative");
    }

    // Rule 4: Initial status must always be PENDING
    data.status = "PENDING";

    const [id] = await db("game_trades").insert(data);
    return this.findById(id);
  },

  // -------------------------
  // 🔹 READ
  // -------------------------
  async findById(id) {
    return db("game_trades as t")
      .leftJoin("games as g", "t.game_id", "g.id")
      .leftJoin("game_players as fp", "t.from_player_id", "fp.id")
      .leftJoin("users as fu", "fp.user_id", "fu.id")
      .leftJoin("game_players as tp", "t.to_player_id", "tp.id")
      .leftJoin("users as tu", "tp.user_id", "tu.id")
      .select(
        "t.*",
        "g.code as game_code",
        "fp.symbol as from_symbol",
        "fu.username as from_username",
        "tp.symbol as to_symbol",
        "tu.username as to_username"
      )
      .where("t.id", id)
      .first();
  },

  async findAll({ limit = 100, offset = 0 } = {}) {
    return db("game_trades as t")
      .leftJoin("games as g", "t.game_id", "g.id")
      .leftJoin("game_players as fp", "t.from_player_id", "fp.id")
      .leftJoin("users as fu", "fp.user_id", "fu.id")
      .leftJoin("game_players as tp", "t.to_player_id", "tp.id")
      .leftJoin("users as tu", "tp.user_id", "tu.id")
      .select(
        "t.*",
        "g.code as game_code",
        "fu.username as from_username",
        "tu.username as to_username"
      )
      .limit(limit)
      .offset(offset)
      .orderBy("t.created_at", "desc");
  },

  async findByGameId(gameId) {
    return db("game_trades as t")
      .leftJoin("game_players as fp", "t.from_player_id", "fp.id")
      .leftJoin("users as fu", "fp.user_id", "fu.id")
      .leftJoin("game_players as tp", "t.to_player_id", "tp.id")
      .leftJoin("users as tu", "tp.user_id", "tu.id")
      .select(
        "t.*",
        "fu.username as from_username",
        "tu.username as to_username"
      )
      .where("t.game_id", gameId)
      .orderBy("t.created_at", "desc");
  },

  async findByPlayerId(playerId) {
    return db("game_trades as t")
      .leftJoin("game_players as fp", "t.from_player_id", "fp.id")
      .leftJoin("users as fu", "fp.user_id", "fu.id")
      .leftJoin("game_players as tp", "t.to_player_id", "tp.id")
      .leftJoin("users as tu", "tp.user_id", "tu.id")
      .select(
        "t.*",
        "fu.username as from_username",
        "tu.username as to_username"
      )
      .where("t.from_player_id", playerId)
      .orWhere("t.to_player_id", playerId)
      .orderBy("t.created_at", "desc");
  },

  // -------------------------
  // 🔹 UPDATE
  // -------------------------
  async update(id, data) {
    const trade = await this.findById(id);
    if (!trade) throw new Error("Trade not found");

    // Rule 5: Once resolved, trade cannot be modified
    if (["ACCEPTED", "REJECTED"].includes(trade.status)) {
      throw new Error("Cannot modify a resolved trade");
    }

    // Rule 6: Only valid status changes
    if (data.status && !VALID_STATUSES.includes(data.status)) {
      throw new Error(
        `Invalid status update. Allowed: ${VALID_STATUSES.join(", ")}`
      );
    }

    await db("game_trades")
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() });

    return this.findById(id);
  },

  // -------------------------
  // 🔹 DELETE
  // -------------------------
  async delete(id) {
    const trade = await this.findById(id);
    if (!trade) throw new Error("Trade not found");

    // Rule 7: Cannot delete an accepted trade
    if (trade.status === "ACCEPTED") {
      throw new Error("Accepted trades cannot be deleted");
    }

    return db("game_trades").where({ id }).del();
  },

  async acceptTrade(tradeId) {
    return withTransaction(async (trx) => {
      // Fetch trade
      const trade = await trx("game_trades").where({ id: tradeId }).first();
      if (!trade) throw new Error("Trade not found");
      if (trade.status !== "PENDING")
        throw new Error("Trade already processed");

      // Fetch trade items
      const items = await trx("game_trade_items").where({ trade_id: tradeId });

      for (const item of items) {
        if (item.type === "PROPERTY") {
          // Update property ownership
          await trx("game_properties")
            .where({
              game_id: trade.game_id,
              property_id: item.property_id,
              player_id: trade.from_player_id, // must currently belong to sender
            })
            .update({
              player_id: trade.to_player_id, // new owner
              updated_at: trx.fn.now(),
            });
        }

        if (item.type === "CASH") {
          // Deduct from sender
          await trx("game_players")
            .where({ id: trade.from_player_id })
            .decrement("balance", item.amount);

          // Credit to receiver
          await trx("game_players")
            .where({ id: trade.to_player_id })
            .increment("balance", item.amount);
        }
      }

      // Mark trade as accepted
      await trx("game_trades")
        .where({ id: tradeId })
        .update({ status: "accepted", updated_at: trx.fn.now() });

      return { success: true, tradeId };
    });
  },
};

export default GameTrade;
