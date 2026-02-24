import User from "../models/User.js";
import { getUserPropertyStats } from "../utils/userPropertyStats.js";

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
      const { username } = req.body || {};
      if (username != null && String(username).trim() !== "") {
        const taken = await User.findByUsernameIgnoreCase(username);
        if (taken) {
          return res.status(409).json({ error: "Username already taken", message: "Username already taken" });
        }
      }
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

  async getPropertyStats(req, res) {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const stats = await getUserPropertyStats(userId);
      res.json(stats ?? { properties_bought: 0, properties_sold: 0, trades_initiated: 0, trades_accepted: 0, favourite_property: null });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

 async findByAddress(req, res) {
  try {
    const { address } = req.params;
    const { chain } = req.query;  // e.g., ?chain=ethereum or ?chain=solana

    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }

    const user = await User.findByAddress(address, chain || null); // or default chain

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error in findByAddress:", error);
    res.status(500).json({ error: error.message });
  }
},

  async findAll(req, res) {
    try {
      const { limit, offset } = req.query;
      const users = await User.findAll({
        limit: Number.parseInt(limit) || 1000,
        offset: Number.parseInt(offset) || 0,
      });
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async update(req, res) {
    try {
      const { username } = req.body || {};
      if (username != null && String(username).trim() !== "") {
        const taken = await User.findByUsernameIgnoreCase(username);
        if (taken && Number(taken.id) !== Number(req.params.id)) {
          return res.status(409).json({ error: "Username already taken", message: "Username already taken" });
        }
      }
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
  // 🏆 Leaderboard (by chain)
  // -------------------------

  /**
   * GET /api/users/leaderboard?chain=&type=wins|earnings|stakes|winrate&limit=20
   * Returns top players for the given chain. Chain can be name (BASE, CELO) or chainId (8453, 42220).
   */
  async getLeaderboard(req, res) {
    try {
      const { chain = "BASE", type = "wins", limit = 20 } = req.query;
      const normalizedLimit = Math.min(Number.parseInt(limit, 10) || 20, 100);
      const normalizedType = String(type).toLowerCase();
      let data;
      switch (normalizedType) {
        case "wins":
          data = await User.getLeaderboardByWins(chain, normalizedLimit);
          break;
        case "earnings":
          data = await User.getLeaderboardByEarnings(chain, normalizedLimit);
          break;
        case "stakes":
          data = await User.getLeaderboardByStakes(chain, normalizedLimit);
          break;
        case "winrate":
          data = await User.getLeaderboardByWinRate(chain, normalizedLimit);
          break;
        default:
          return res.status(400).json({ error: "Invalid type. Use: wins, earnings, stakes, winrate" });
      }
      res.json(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Leaderboard error:", error);
      res.status(500).json({ error: error.message });
    }
  },
};

export default userController;
