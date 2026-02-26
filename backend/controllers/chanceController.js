import Chance from "../models/Chance.js";

/**
 * Chance Controller
 *
 * Handles requests related to chances.
 */
const chanceController = {
  // -------------------------
  // 🔹 CRUD
  // -------------------------

  async create(req, res) {
    try {
      const chance = await Chance.create(req.body);
      res.status(201).json(chance);
    } catch (error) {
      console.error("Error creating chance:", error);
      res.status(400).json({ error: error.message });
    }
  },

  async findById(req, res) {
    try {
      const chance = await Chance.findById(req.params.id);
      if (!chance) return res.status(404).json({ error: "Chance not found" });
      res.json(chance);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const { limit, offset } = req.query;
      const chances = await Chance.findAll({
        limit: Number.parseInt(limit) || 100,
        offset: Number.parseInt(offset) || 0,
      });
      res.json(chances);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async update(req, res) {
    try {
      const chance = await Chance.update(req.params.id, req.body);
      res.json(chance);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async remove(req, res) {
    try {
      await Chance.delete(req.params.id);
      res.json({ message: "Chance deleted" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

export default chanceController;
