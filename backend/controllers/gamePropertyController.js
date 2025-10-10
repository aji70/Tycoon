import GameProperty from "../models/GameProperty.js";

const gamePropertyController = {
  async create(req, res) {
    try {
      const property = await GameProperty.create(req.body);
      res
        .status(201)
        .json({ success: true, message: "successful", data: property });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async findById(req, res) {
    try {
      const property = await GameProperty.findById(req.params.id);
      if (!property)
        return res.status(404).json({ error: "Game property not found" });
      res.json({ success: true, message: "successful", data: property });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const { limit, offset } = req.query;
      const properties = await GameProperty.findAll({
        limit: Number.parseInt(limit) || 100,
        offset: Number.parseInt(offset) || 0,
      });
      res.json({ success: true, message: "successful", data: properties });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findByGame(req, res) {
    try {
      const properties = await GameProperty.findByGameId(req.params.gameId);
      res.json({ success: true, message: "successful", data: properties });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findByPlayer(req, res) {
    try {
      const properties = await GameProperty.findByPlayerId(req.params.playerId);
      res.json({ success: true, message: "successful", data: properties });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async update(req, res) {
    try {
      const property = await GameProperty.update(req.params.id, req.body);
      res.json({ success: true, message: "successful", data: property });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async remove(req, res) {
    try {
      await GameProperty.delete(req.params.id);
      res.json({ success: true, message: "successful", data: null });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
};

export default gamePropertyController;
