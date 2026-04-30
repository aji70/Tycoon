import GamePlayHistory from "../models/GamePlayHistory.js";

const gamePlayHistoryController = {
  async create(req, res) {
    try {
      const history = await GamePlayHistory.create(req.body);
      res.status(201).json(history);
    } catch (error) {
      console.error("Error creating game play history:", error);
      res.status(400).json({ error: error.message });
    }
  },

  async findById(req, res) {
    try {
      const history = await GamePlayHistory.findById(req.params.id);
      if (!history)
        return res.status(404).json({ error: "History entry not found" });
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const { limit, offset } = req.query;
      const histories = await GamePlayHistory.findAll({
        limit: Number.parseInt(limit) || 100,
        offset: Number.parseInt(offset) || 0,
      });
      res.json(histories);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async findByGame(req, res) {
    try {
      const { limit, offset } = req.query;
      const histories = await GamePlayHistory.findByGameId(req.params.gameId, {
        limit: Number.parseInt(limit) || 200,
        offset: Number.parseInt(offset) || 0,
      });
      res.json(histories);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async findByPlayer(req, res) {
    try {
      const { limit, offset } = req.query;
      const histories = await GamePlayHistory.findByPlayerId(
        req.params.playerId,
        {
          limit: Number.parseInt(limit) || 100,
          offset: Number.parseInt(offset) || 0,
        }
      );
      res.json(histories);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async update(req, res) {
    try {
      const history = await GamePlayHistory.update(req.params.id, req.body);
      res.json(history);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async remove(req, res) {
    try {
      await GamePlayHistory.delete(req.params.id);
      res.json({ message: "History entry removed" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

export default gamePlayHistoryController;
