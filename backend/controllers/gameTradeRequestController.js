import GameTradeRequest from "../models/GameTradeRequest.js";

export const GameTradeRequestController = {
  // ✅ Create a new trade request
  async create(req, res) {
    try {
      const data = req.body;
      const trade = await GameTradeRequest.create(data);
      return res.status(201).json({ success: true, data: trade });
    } catch (error) {
      console.error("Create Trade Error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to create trade request" });
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
      const trades = await GameTradeRequest.getByGameIdAndPlayerId(
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

  // ✅ Get all trades by game_id + player_id + status
  async getByGameIdAndPlayerIdAndStatus(req, res) {
    try {
      const { game_id, player_id, status } = req.params;
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
};
