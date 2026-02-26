import CommunityChest from "../models/CommunityChest.js";

/**
 * CommunityChest Controller
 *
 * Handles requests related to community chests
 */
const communityChestController = {
  // -------------------------
  // 🔹 CRUD
  // -------------------------

  async create(req, res) {
    try {
      const communityChest = await CommunityChest.create(req.body);
      res.status(201).json(communityChest);
    } catch (error) {
      console.error("Error creating community chest:", error);
      res.status(400).json({ error: error.message });
    }
  },

  async findById(req, res) {
    try {
      const communityChest = await CommunityChest.findById(req.params.id);
      if (!communityChest)
        return res.status(404).json({ error: "Community chest not found" });
      res.json(communityChest);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const { limit, offset } = req.query;
      const communityChests = await CommunityChest.findAll({
        limit: Number.parseInt(limit) || 100,
        offset: Number.parseInt(offset) || 0,
      });
      res.json(communityChests);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async update(req, res) {
    try {
      const communityChest = await CommunityChest.update(
        req.params.id,
        req.body
      );
      res.json(communityChest);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async remove(req, res) {
    try {
      await CommunityChest.delete(req.params.id);
      res.json({ message: "Community chest deleted" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

export default communityChestController;
