import GameSetting from "../models/GameSetting.js";

/**
 * GameSetting Controller
 *
 * Handles requests related to game configuration.
 */
const gameSettingController = {
  // -------------------------
  // 🔹 CRUD
  // -------------------------

  async create(req, res) {
    try {
      const setting = await GameSetting.create(req.body);
      res.status(201).json(setting);
    } catch (error) {
      console.error("Error creating game setting:", error);
      res.status(400).json({ error: error.message });
    }
  },

  async findById(req, res) {
    try {
      const setting = await GameSetting.findById(req.params.id);
      if (!setting)
        return res.status(404).json({ error: "Game setting not found" });
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async findByGameId(req, res) {
    try {
      const setting = await GameSetting.findByGameId(req.params.gameId);
      if (!setting)
        return res
          .status(404)
          .json({ error: "Settings for this game not found" });
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const { limit, offset } = req.query;
      const settings = await GameSetting.findAll({
        limit: Number.parseInt(limit) || 100,
        offset: Number.parseInt(offset) || 0,
      });
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async update(req, res) {
    try {
      const setting = await GameSetting.update(req.params.id, req.body);
      res.json(setting);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async updateByGameId(req, res) {
    try {
      const setting = await GameSetting.updateByGameId(
        req.params.gameId,
        req.body
      );
      res.json(setting);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async remove(req, res) {
    try {
      await GameSetting.delete(req.params.id);
      res.json({ message: "Game setting deleted" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async removeByGameId(req, res) {
    try {
      await GameSetting.deleteByGameId(req.params.gameId);
      res.json({ message: "Game setting deleted for game" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

export default gameSettingController;
