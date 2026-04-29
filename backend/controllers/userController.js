import User from "../models/User.js";
import { getUserPropertyStats } from "../utils/userPropertyStats.js";
import { callContractRead, getSmartWalletAddress, isContractConfigured } from "../services/tycoonContract.js";

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
      const { username, chain, address } = req.body || {};
      if (username != null && String(username).trim() !== "") {
        const chainToCheck = chain || "CELO";
        const taken = await User.findByUsernameIgnoreCaseInChain(username, chainToCheck);
        if (taken) {
          return res.status(409).json({ error: "Username already taken", message: "Username already taken on this chain" });
        }
      }
      const createPayload = { ...req.body };
      // If user has address and chain and contract is configured, sync smart_wallet_address from chain (hero registrations)
      if (address && (createPayload.chain || chain)) {
        const chainNorm = User.normalizeChain(createPayload.chain || chain || "CELO");
        if (isContractConfigured(chainNorm)) {
          try {
            const isRegistered = await callContractRead("registered", [address], chainNorm);
            if (isRegistered) {
              const smartWallet = await getSmartWalletAddress(address, chainNorm);
              if (smartWallet) createPayload.smart_wallet_address = smartWallet;
            }
          } catch (_) {}
        }
      }
      const user = await User.create(createPayload);
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

    const user = await User.resolveUserByAddress(address, chain || "BASE");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error in findByAddress:", error);
    res.status(500).json({ error: error.message });
  }
},

 async findByUsername(req, res) {
  try {
    const { username } = req.params;
    const { chain } = req.query;
    if (!username || String(username).trim() === "") {
      return res.status(400).json({ error: "Username is required" });
    }

    const name = String(username).trim();
    const user = chain
      ? await User.findByUsernameIgnoreCaseInChain(name, chain)
      : await User.findByUsernameIgnoreCase(name);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error in findByUsername:", error);
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
        const existing = await User.findById(req.params.id);
        const chainToCheck = existing?.chain || "BASE";
        const taken = await User.findByUsernameIgnoreCaseInChain(username, chainToCheck);
        if (taken && Number(taken.id) !== Number(req.params.id)) {
          return res.status(409).json({ error: "Username already taken", message: "Username already taken on this chain" });
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
   * GET /api/users/leaderboard?chain=&type=wins|earnings|stakes|winrate|played&limit=20&period=all|month|range&month=YYYY-MM&start=ISO&end=ISO
   * Returns top players for the given chain. Chain can be name (BASE, CELO) or chainId (8453, 42220).
   * period=month uses finished games in the UTC month (month= defaults to current UTC). Monthly is supported for wins and winrate only.
   * period=range uses [start, end) UTC timestamps. Range currently supports type=played.
   */
  async getLeaderboard(req, res) {
    try {
      const { chain = "CELO", type = "wins", limit = 20, period = "all", month, start, end } = req.query;
      const normalizedLimit = Math.min(Number.parseInt(limit, 10) || 20, 100);
      const normalizedType = String(type).toLowerCase();
      const rawPeriod = String(period).toLowerCase();
      const periodNorm = rawPeriod === "month" ? "month" : rawPeriod === "range" ? "range" : "all";
      let data;
      if (periodNorm === "range") {
        if (normalizedType !== "played") {
          return res.status(400).json({
            error: "range_not_supported",
            message: "Range leaderboard currently supports type=played only.",
          });
        }
        if (!start || !end) {
          return res.status(400).json({
            error: "missing_range_params",
            message: "Provide start and end ISO timestamps for period=range.",
          });
        }
        data = await User.getRangeLeaderboardByGamesPlayed(chain, String(start), String(end), normalizedLimit);
      } else if (periodNorm === "month") {
        switch (normalizedType) {
          case "wins":
            data = await User.getMonthlyLeaderboardByWins(chain, month, normalizedLimit);
            break;
          case "winrate":
            data = await User.getMonthlyLeaderboardByWinRate(chain, month, normalizedLimit);
            break;
          case "earnings":
          case "stakes":
          case "played":
            return res.status(400).json({
              error: "monthly_not_supported",
              message: "Monthly leaderboard is available for wins and win rate. Earnings/stakes are all-time totals and played uses period=range.",
            });
          default:
            return res.status(400).json({ error: "Invalid type. Use: wins, earnings, stakes, winrate, played" });
        }
      } else {
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
          case "played":
            data = await User.getLeaderboardByWins(chain, normalizedLimit);
            break;
          default:
            return res.status(400).json({ error: "Invalid type. Use: wins, earnings, stakes, winrate, played" });
        }
      }
      res.json(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Leaderboard error:", error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * POST /api/users/sync-leaderboard?chain=CELO
   * Fetches each user's stats from the chain (getUser) and updates the DB.
   * This backfills the leaderboard with full on-chain history so it's not "starting from now".
   * Backend contract is configured for Celo only; other chains are no-ops.
   */
  async syncLeaderboardFromChain(req, res) {
    try {
      const { chain = "CELO" } = req.query;
      const normalized = User.normalizeChain(chain);
      if (!isContractConfigured(normalized)) {
        return res.status(503).json({
          error: "Contract not configured",
          message: `Backend cannot read from chain ${normalized}. Set ${normalized}_RPC_URL and TYCOON_${normalized}_CONTRACT_ADDRESS.`,
        });
      }
      const users = await User.findAllByChain(normalized, { limit: 500 });
      let updated = 0;
      let failed = 0;
      for (const user of users) {
        try {
          const raw = await callContractRead("getUser", [user.username], normalized);
          const r = raw && (Array.isArray(raw) ? raw : [raw[0], raw[1], raw[2], raw[3], raw[4], raw[5], raw[6], raw[7], raw[8], raw[9]]);
          if (!r || r.length < 10) continue;
          const gamesPlayed = Number(r[4] ?? 0);
          const gameWon = Number(r[5] ?? 0);
          const gameLost = Number(r[6] ?? 0);
          const totalStaked = Number(r[7] ?? 0);
          const totalEarned = Number(r[8] ?? 0);
          const totalWithdrawn = Number(r[9] ?? 0);
          await User.update(user.id, {
            games_played: gamesPlayed,
            game_won: gameWon,
            game_lost: gameLost,
            total_staked: totalStaked,
            total_earned: totalEarned,
            total_withdrawn: totalWithdrawn,
          });
          updated++;
        } catch (err) {
          failed++;
        }
      }
      res.json({
        message: "Leaderboard synced from chain",
        chain: normalized,
        usersProcessed: users.length,
        updated,
        failed,
      });
    } catch (error) {
      console.error("Sync leaderboard error:", error);
      res.status(500).json({ error: error.message });
    }
  },
};

export default userController;
