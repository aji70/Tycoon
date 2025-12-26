import User from "../models/User.js";

/**
 * User Controller
 *
 * Handles requests related to users and leaderboards.
 */
const userController = {
  // -------------------------
  // 🔹 CRUD
  // -------------------------

  async create(req, res) {
    try {
      const user = await User.create(req.body);
      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(400).json({ error: error.message });
    }
  },

  async findById(req, res) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async findByAddress(req, res) {
    try {
      const { address, chain } = req.params;
      const user = await User.findByAddress(address, chain);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const { limit, offset } = req.query;
      const users = await User.findAll({
        limit: Number.parseInt(limit) || 100,
        offset: Number.parseInt(offset) || 0,
      });
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async update(req, res) {
    try {
      const user = await User.update(req.params.id, req.body);
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async remove(req, res) {
    try {
      await User.delete(req.params.id);
      res.json({ message: "User deleted" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // -------------------------
  // 🏆 Leaderboards
  // -------------------------

  async leaderboardByWins(req, res) {
    try {
      const { limit } = req.query;
      const data = await User.leaderboardByWins(Number.parseInt(limit) || 10);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async leaderboardByEarnings(req, res) {
    try {
      const { limit } = req.query;
      const data = await User.leaderboardByEarnings(Number.parseInt(limit) || 10);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async leaderboardByStakes(req, res) {
    try {
      const { limit } = req.query;
      const data = await User.leaderboardByStakes(Number.parseInt(limit) || 10);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async leaderboardByWinRate(req, res) {
    try {
      const { limit } = req.query;
      const data = await User.leaderboardByWinRate(Number.parseInt(limit) || 10);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

export default userController;
