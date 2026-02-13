import GameTrade from "../models/GameTrade.js";
import db from "../config/database.js";
import { transferPropertyOwnership, isContractConfigured } from "../services/tycoonContract.js";
import {
  recordPropertyPurchase,
  incrementPropertiesSold,
  incrementTradesInitiated,
  incrementTradesAccepted,
} from "../utils/userPropertyStats.js";
import logger from "../config/logger.js";

const gameTradeController = {
  async create(req, res) {
    try {
      const trade = await GameTrade.create(req.body);
      res.status(201).json(trade);
    } catch (error) {
      console.error("Error creating trade:", error);
      res.status(400).json({ error: error.message });
    }
  },

  async findById(req, res) {
    try {
      const trade = await GameTrade.findById(req.params.id);
      if (!trade) return res.status(404).json({ error: "Trade not found" });
      res.json(trade);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const { limit, offset } = req.query;
      const trades = await GameTrade.findAll({
        limit: Number.parseInt(limit) || 100,
        offset: Number.parseInt(offset) || 0,
      });
      res.json(trades);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async findByGame(req, res) {
    try {
      const trades = await GameTrade.findByGameId(req.params.gameId);
      res.json(trades);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async findByPlayer(req, res) {
    try {
      const trades = await GameTrade.findByPlayerId(req.params.playerId);
      res.json(trades);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async update(req, res) {
    try {
      const trade = await GameTrade.update(req.params.id, req.body);
      res.json(trade);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async remove(req, res) {
    try {
      await GameTrade.delete(req.params.id);
      res.json({ message: "Trade removed" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  async accept(req, res) {
    try {
      const result = await GameTrade.acceptTrade(req.params.id);
      const tradeId = req.params.id;

      // Stats: record property purchases, trades initiated/accepted
      if (result?.success) {
        (async () => {
          try {
            const trade = await GameTrade.findById(tradeId);
            const items = await db("game_trade_items").where({ trade_id: tradeId });
            const [fromPlayer, toPlayer] = await Promise.all([
              db("game_players").where({ id: trade.from_player_id }).select("user_id").first(),
              db("game_players").where({ id: trade.to_player_id }).select("user_id").first(),
            ]);
            const fromUserId = fromPlayer?.user_id ?? null;
            const toUserId = toPlayer?.user_id ?? null;

            if (fromUserId) await incrementTradesInitiated(fromUserId);
            if (toUserId) await incrementTradesAccepted(toUserId);

            const propertyItems = items.filter((i) => i.type === "PROPERTY" || i.property_id);
            for (const item of propertyItems) {
              if (fromUserId) await incrementPropertiesSold(fromUserId);
              if (toUserId && item.property_id) await recordPropertyPurchase(toUserId, item.property_id, trade.game_id, "trade");
            }
          } catch (_) {}
        })();
      }

      // On-chain: record property transfers for each property in the trade (fire-and-forget)
      if (isContractConfigured() && result?.success) {
        (async () => {
          try {
            const trade = await GameTrade.findById(tradeId);
            const items = await db("game_trade_items").where({ trade_id: tradeId });
            const propertyItems = items.filter((i) => i.type === "PROPERTY" || i.property_id);
            const sellerUsername = trade?.from_username ?? null;
            const buyerUsername = trade?.to_username ?? null;

            if (sellerUsername && buyerUsername && propertyItems.length > 0) {
              for (let i = 0; i < propertyItems.length; i++) {
                await transferPropertyOwnership(sellerUsername, buyerUsername);
              }
            }
          } catch (err) {
            logger.warn({ err, tradeId }, "Tycoon transferPropertyOwnership failed (trade)");
          }
        })();
      }

      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },
};

export default gameTradeController;
