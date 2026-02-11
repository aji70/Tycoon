import GameTrade from "../models/GameTrade.js";

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
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },
};

export default gameTradeController;
