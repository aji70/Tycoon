import db from "../config/database.js";
import GameTradeRequest from "../models/GameTradeRequest.js";
import { safeJsonParse } from "../utils/string.js";

export const GameTradeRequestController = {
  // CREATE TRADE REQUEST
  async create(req, res) {
    const trx = await db.transaction();
    try {
      const {
        id,
        game_id,
        player_id,
        target_player_id,
        offer_properties = [],
        offer_amount = 0,
        requested_properties = [],
        requested_amount = 0,
        status = "pending",
      } = req.body;

      // 1️⃣ Check game is active
      const game = await trx("games")
        .where({ id: game_id, status: "RUNNING" })
        .first();
      if (!game) {
        await trx.rollback();
        return res
          .status(400)
          .json({ success: false, message: "Game not running or not found" });
      }

      // 2️⃣ Verify both players exist in game and target not in jail
      const player = await trx("game_players")
        .where({ game_id, user_id: player_id })
        .first();
      const targetPlayer = await trx("game_players")
        .where({ game_id, user_id: target_player_id })
        .first();

      if (!player || !targetPlayer) {
        await trx.rollback();
        return res.status(404).json({
          success: false,
          message: "Player(s) not found in this game",
        });
      }

      if (targetPlayer.in_jail) {
        await trx.rollback();
        return res
          .status(400)
          .json({ success: false, message: "Target player is in jail" });
      }

      // 3️⃣ Validate offered and requested properties ownership
      const offeredProps = await trx("game_properties")
        .whereIn("property_id", offer_properties)
        .andWhere({ game_id, player_id: player.id });

      const requestedProps = await trx("game_properties")
        .whereIn("property_id", requested_properties)
        .andWhere({ game_id, player_id: targetPlayer.id });

      if (offeredProps.length !== offer_properties.length) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: "Invalid offered property ownership",
        });
      }

      if (requestedProps.length !== requested_properties.length) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: "Invalid requested property ownership",
        });
      }

      // 4️⃣ Check sufficient balances for cash offers
      if (player.balance < offer_amount) {
        await trx.rollback();
        return res
          .status(400)
          .json({ success: false, message: "Player has insufficient balance" });
      }

      if (targetPlayer.balance < requested_amount) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: "Target player has insufficient balance",
        });
      }

      // 5️⃣ Create trade request entry
      const [tradeId] = await trx("game_trade_requests").insert({
        id,
        game_id,
        player_id,
        target_player_id,
        offer_properties: JSON.stringify(offer_properties),
        offer_amount,
        requested_properties: JSON.stringify(requested_properties),
        requested_amount,
        status,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Commit initial insert
      await trx.commit();
      const trade = await db("game_trade_requests")
        .where({ id: tradeId })
        .first();

      return res.status(201).json({ success: true, data: trade });
    } catch (error) {
      await trx.rollback();
      console.error("Create Trade Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create trade request" + error?.message,
      });
    }
  },

  // ACCEPT TRADE
  async accept(req, res) {
    const { id } = req.body;
    const trx = await db.transaction();

    try {
      const trade = await trx("game_trade_requests").where({ id }).first();
      if (!trade) {
        await trx.rollback();
        return res
          .status(404)
          .json({ success: false, message: "Trade not found" });
      }

      if (trade.status !== "pending" && trade.status !== "counter") {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: "Trade not available for acceptance",
        });
      }

      const {
        game_id,
        player_id,
        target_player_id,
        offer_properties,
        offer_amount: _offer_amount,
        requested_properties,
        requested_amount: _requested_amount,
      } = trade;

      const offer_amount = Number(_offer_amount);
      const requested_amount = Number(_requested_amount);

      // Parse JSON fields
      const offeredProps = safeJsonParse(offer_properties);
      const requestedProps = safeJsonParse(requested_properties);

      console.log(offer_properties, requested_properties)

      const player = await trx("game_players")
        .where({ game_id, user_id: player_id })
        .first();
      const target_player = await trx("game_players")
        .where({ game_id, user_id: target_player_id })
        .first();

      if (!player || !target_player) {
        await trx.rollback();
        return res
          .status(404)
          .json({ success: false, message: "Player(s) not found" });
      }

      // 1️⃣ Exchange properties
      if (offeredProps.length > 0) {
        await trx("game_properties")
          .whereIn("property_id", offeredProps)
          .andWhere({ game_id })
          .andWhere({ player_id: player.id })
          .update({ player_id: target_player.id });
      }

      if (requestedProps.length > 0) {
        await trx("game_properties")
          .whereIn("property_id", requestedProps)
          .andWhere({ game_id })
          .andWhere({ player_id: target_player.id })
          .update({ player_id: player.id });
      }

      // 2️⃣ Update balances
      const playerNewBalance =
        Number(player.balance) - offer_amount + requested_amount;
      const targetNewBalance =
        Number(target_player.balance) + offer_amount - requested_amount;

      await trx("game_players")
        .where({ id: player.id })
        .update({ balance: playerNewBalance, updated_at: new Date() });

      await trx("game_players")
        .where({ id: target_player.id })
        .update({ balance: targetNewBalance, updated_at: new Date() });

      // 3️⃣ Update trade status
      await trx("game_trade_requests").where({ id }).update({
        status: "accepted",
        updated_at: new Date(),
      });

      await trx("game_trades").insert({
        game_id,
        from_player_id: player.id,
        to_player_id: target_player.id,
        type: "MIXED",
        status: "ACCEPTED",
        sending_amount: Number(offer_amount),
        receiving_amount: Number(offer_amount),
        created_at: new Date(),
        updated_at: new Date(),
      });
      await trx.commit();

      return res.json({
        success: true,
        message: "Trade accepted successfully",
      });
    } catch (error) {
      await trx.rollback();
      console.error("Accept Trade Error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to accept trade" });
    }
  },

  // DECLINE TRADE
  async decline(req, res) {
    try {
      const { id } = req.body;
      await db("game_trade_requests").where({ id }).update({
        status: "declined",
        updated_at: new Date(),
      });
      res.json({ success: true, message: "Trade declined" });
    } catch (error) {
      console.error("Decline Trade Error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to decline trade" });
    }
  },

  // ✅ Get trade by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const trade = await GameTradeRequest.getById(id);
      if (!trade)
        return res
          .status(404)
          .json({ success: false, message: "Trade not found" });
      res.json({ success: true, data: trade });
    } catch (error) {
      console.error("Get Trade Error:", error);
      res.status(500).json({ success: false, message: "Error fetching trade" });
    }
  },

  // ✅ Update a trade
  async update(req, res) {
    try {
      const { id } = req.params;
      const updated = await GameTradeRequest.update(id, req.body);
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error("Update Trade Error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to update trade request" });
    }
  },

  // ✅ Delete a trade
  async remove(req, res) {
    try {
      const { id } = req.params;
      await GameTradeRequest.delete(id);
      res.json({ success: true, message: "Trade deleted" });
    } catch (error) {
      console.error("Delete Trade Error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to delete trade" });
    }
  },

  // ✅ Get all trades by game_id
  async getByGameId(req, res) {
    try {
      const { game_id } = req.params;
      const trades = await GameTradeRequest.getByGameId(game_id);
      res.json({ success: true, data: trades });
    } catch (error) {
      console.error("Get By Game Error:", error);
      res
        .status(500)
        .json({ success: false, message: "Error fetching trades by game" });
    }
  },

  // ✅ Get all trades for player (initiator or target)
  async getByGameIdAndPlayerId(req, res) {
    try {
      const { game_id, player_id } = req.params;
      const { status } = req.query;
      const trades = await GameTradeRequest.getByGameIdAndPlayerId(
        game_id,
        player_id,
        status
      );
      res.json({ success: true, data: trades });
    } catch (error) {
      console.error("Get By Player Error:", error);
      res
        .status(500)
        .json({ success: false, message: "Error fetching trades by player" });
    }
  },

  // ✅ Get all trades by game_id + player_id + status
  async getByGameIdAndPlayerIdAndStatus(req, res) {
    try {
      const { game_id, player_id } = req.params;
      const { status } = req.query;
      const trades = await GameTradeRequest.getByGameIdAndPlayerIdAndStatus(
        game_id,
        player_id,
        status
      );
      res.json({ success: true, data: trades });
    } catch (error) {
      console.error("Get By Player+Status Error:", error);
      res
        .status(500)
        .json({ success: false, message: "Error fetching trades by status" });
    }
  },
  async myTradeRequests(req, res) {
    try {
      const { game_id, player_id } = req.params;
      const trades = await GameTradeRequest.myTradeRequests(game_id, player_id);
      res.json({ success: true, data: trades });
    } catch (error) {
      console.error("Get By Player Error:", error);
      res
        .status(500)
        .json({ success: false, message: "Error fetching trades by player" });
    }
  },
  async incomingTradeRequests(req, res) {
    try {
      const { game_id, player_id } = req.params;
      const trades = await GameTradeRequest.incomingTradeRequests(
        game_id,
        player_id
      );
      res.json({ success: true, data: trades });
    } catch (error) {
      console.error("Get By Player Error:", error);
      res
        .status(500)
        .json({ success: false, message: "Error fetching trades by player" });
    }
  },
};
