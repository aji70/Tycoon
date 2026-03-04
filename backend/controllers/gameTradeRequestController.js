import db from "../config/database.js";
import Game from "../models/Game.js";
import GameTradeRequest from "../models/GameTradeRequest.js";
import User from "../models/User.js";
import { safeJsonParse } from "../utils/string.js";
import { transferPropertyOwnership, isContractConfigured } from "../services/tycoonContract.js";
import {
  recordPropertyPurchase,
  incrementPropertiesSold,
  incrementTradesInitiated,
  incrementTradesAccepted,
} from "../utils/userPropertyStats.js";
import { invalidateGameById } from "../utils/gameCache.js";
import { emitGameUpdateByGameId } from "../utils/socketHelpers.js";
import logger from "../config/logger.js";

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

      // Parse JSON fields (stored as JSON strings in DB)
      const offeredProps = safeJsonParse(offer_properties);
      const requestedProps = safeJsonParse(requested_properties);

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

      const proposerUser = await trx("users").where({ id: player.user_id }).select("username").first();
      const proposerUsername = proposerUser?.username ?? "Player";
      await trx("game_play_history").insert({
        game_id,
        game_player_id: target_player.id,
        rolled: null,
        old_position: null,
        new_position: null,
        action: "trade_accept",
        amount: 0,
        extra: null,
        comment: `accepted trade with ${proposerUsername}`,
        active: 1,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await trx.commit();

      // Notify clients so balance updates immediately
      const io = req.app.get("io");
      if (io && game_id) await emitGameUpdateByGameId(io, game_id);
      await invalidateGameById(game_id);

      const playerUser = await db("users").where({ id: player.user_id }).select("username").first();
      const targetUser = await db("users").where({ id: target_player.user_id }).select("username").first();
      const playerUsername = playerUser?.username ?? null;
      const targetUsername = targetUser?.username ?? null;

      incrementTradesInitiated(player.user_id).catch(() => {});
      incrementTradesAccepted(target_player.user_id).catch(() => {});
      for (const propId of offeredProps) {
        incrementPropertiesSold(player.user_id).catch(() => {});
        recordPropertyPurchase(target_player.user_id, propId, game_id, "trade").catch(() => {});
      }
      for (const propId of requestedProps) {
        incrementPropertiesSold(target_player.user_id).catch(() => {});
        recordPropertyPurchase(player.user_id, propId, game_id, "trade").catch(() => {});
      }

      const game = await Game.findById(game_id);
      const chainForTrade = game ? User.normalizeChain(game.chain || "CELO") : "CELO";
      if (isContractConfigured(chainForTrade) && playerUsername && targetUsername) {
        (async () => {
          try {
            for (const _ of offeredProps) {
              await transferPropertyOwnership(playerUsername, targetUsername, chainForTrade);
            }
            for (const _ of requestedProps) {
              await transferPropertyOwnership(targetUsername, playerUsername, chainForTrade);
            }
          } catch (err) {
            logger.warn({ err, game_id }, "Tycoon transferPropertyOwnership failed (trade request accept)");
          }
        })();
      }

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

  // AI COUNTER: decline original trade and create a new trade from AI to human with counter terms
  async aiCounter(req, res) {
    const trx = await db.transaction();
    try {
      const {
        original_trade_id,
        counter_offer_properties = [],
        counter_offer_amount = 0,
        counter_requested_properties = [],
        counter_requested_amount = 0,
      } = req.body;

      const original = await trx("game_trade_requests").where({ id: original_trade_id }).first();
      if (!original || original.status !== "pending") {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: "Original trade not found or not pending",
        });
      }

      const game = await trx("games").where({ id: original.game_id, status: "RUNNING" }).first();
      if (!game || !game.is_ai) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: "Game not running or not an AI game",
        });
      }

      // Counter is from AI (original target) to human (original initiator)
      const aiUserId = original.target_player_id;
      const humanUserId = original.player_id;
      const player = await trx("game_players").where({ game_id: original.game_id, user_id: aiUserId }).first();
      const targetPlayer = await trx("game_players").where({ game_id: original.game_id, user_id: humanUserId }).first();
      if (!player || !targetPlayer) {
        await trx.rollback();
        return res.status(404).json({ success: false, message: "Player(s) not found in this game" });
      }
      if (targetPlayer.in_jail) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: "Target player is in jail" });
      }

      const offerProps = await trx("game_properties")
        .whereIn("property_id", counter_offer_properties)
        .andWhere({ game_id: original.game_id, player_id: player.id });
      const requestedProps = await trx("game_properties")
        .whereIn("property_id", counter_requested_properties)
        .andWhere({ game_id: original.game_id, player_id: targetPlayer.id });
      if (offerProps.length !== counter_offer_properties.length) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: "Invalid counter offered property ownership" });
      }
      if (requestedProps.length !== counter_requested_properties.length) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: "Invalid counter requested property ownership" });
      }
      if (Number(player.balance) < counter_offer_amount) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: "AI has insufficient balance for counter offer" });
      }
      if (Number(targetPlayer.balance) < counter_requested_amount) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: "You have insufficient balance for the counter request" });
      }

      await trx("game_trade_requests").where({ id: original_trade_id }).update({
        status: "declined",
        updated_at: new Date(),
      });

      await trx("game_trade_requests").insert({
        game_id: original.game_id,
        player_id: aiUserId,
        target_player_id: humanUserId,
        offer_properties: JSON.stringify(counter_offer_properties),
        offer_amount: counter_offer_amount,
        requested_properties: JSON.stringify(counter_requested_properties),
        requested_amount: counter_requested_amount,
        status: "pending",
        created_at: new Date(),
        updated_at: new Date(),
      });

      await trx.commit();

      const newTrade = await db("game_trade_requests")
        .where({
          game_id: original.game_id,
          player_id: aiUserId,
          target_player_id: humanUserId,
          status: "pending",
        })
        .orderBy("created_at", "desc")
        .first();
      const io = req.app.get("io");
      if (io && original.game_id) await emitGameUpdateByGameId(io, original.game_id);
      await invalidateGameById(original.game_id);

      return res.status(201).json({ success: true, data: newTrade, message: "AI counter offer created" });
    } catch (error) {
      await trx.rollback();
      console.error("AI Counter Trade Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create AI counter offer",
      });
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
