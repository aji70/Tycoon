import db from "../config/database.js";

const User = {
  /**
   * Create a new user
   */
  async create(userData) {
    const [id] = await db("users").insert(userData);
    return this.findById(id);
  },

  /**
   * Find by primary key
   */
  async findById(id) {
    return await db("users").where({ id }).first();
  },

  /**
   * Find by wallet address + chain
   */
  async findByAddress(address, chain = "BASE") {
    return await db("users").where({ address, chain }).first();
  },

  /**
   * Find by wallet address only (any chain). Use when address is unique (e.g. AI bots).
   */
  async findByAddressOnly(address) {
    return await db("users").where({ address }).first();
  },

  /**
   * Find user by linked_wallet_address and chain (for guest-linked wallet).
   * Compares address case-insensitively (Ethereum addresses).
   */
  async findByLinkedWallet(address, chain) {
    if (!address || !chain) return null;
    const normalizedChain = this.normalizeChain(chain);
    const addr = String(address).trim().toLowerCase();
    const row = await db("users")
      .where({ linked_wallet_chain: normalizedChain })
      .whereRaw("LOWER(TRIM(linked_wallet_address)) = ?", [addr])
      .first();
    return row;
  },

  /**
   * Resolve user by address: try primary (address, chain) then linked_wallet (address, chain).
   * Falls back to other chains (CELO, BASE, POLYGON) if not found on given chain.
   * Use this wherever we identify user by "connected wallet" (create game, join game, etc.).
   */
  async resolveUserByAddress(address, chain) {
    if (!address) return null;
    const normalizedChain = this.normalizeChain(chain);
    const chainsToTry = [normalizedChain];
    if (normalizedChain !== "CELO") chainsToTry.push("CELO");
    if (normalizedChain !== "BASE") chainsToTry.push("BASE");
    if (normalizedChain !== "POLYGON") chainsToTry.push("POLYGON");
    for (const c of chainsToTry) {
      let user = await this.findByAddress(address, c);
      if (user) return user;
      user = await this.findByLinkedWallet(address, c);
      if (user) return user;
    }
    return null;
  },

  /**
   * Find by username (exact match)
   */
  async findByUsername(username) {
    return await db("users").where({ username }).first();
  },

  /**
   * Find by username case-insensitive (for "username taken" checks).
   * Returns existing user if any row has the same username ignoring case.
   */
  async findByUsernameIgnoreCase(username) {
    if (username == null || String(username).trim() === "") return null;
    const normalized = String(username).trim().toLowerCase();
    return await db("users").whereRaw("LOWER(TRIM(username)) = ?", [normalized]).first();
  },

  /**
   * Find by email (for login with email). Email stored lowercase.
   */
  async findByEmail(email) {
    if (!email || typeof email !== "string") return null;
    const normalized = String(email).trim().toLowerCase();
    return await db("users").whereRaw("LOWER(TRIM(email)) = ?", [normalized]).first();
  },

  /**
   * Find by email verification token (for magic link).
   */
  async findByEmailVerificationToken(token) {
    if (!token) return null;
    return await db("users")
      .where({ email_verification_token: token })
      .where("email_verification_expires_at", ">", new Date())
      .first();
  },

  /**
   * Find by username case-insensitive within a given chain (for "username taken" checks per chain).
   * Same username is allowed on different chains.
   */
  async findByUsernameIgnoreCaseInChain(username, chain) {
    if (username == null || String(username).trim() === "") return null;
    const normalizedChain = this.normalizeChain(chain);
    const normalized = String(username).trim().toLowerCase();
    return await db("users")
      .where({ chain: normalizedChain })
      .whereRaw("LOWER(TRIM(username)) = ?", [normalized])
      .first();
  },

  /**
   * Get all users (optional limit/offset)
   */
  async findAll({ limit = 100, offset = 0 } = {}) {
    return await db("users")
      .select("*")
      .limit(limit)
      .offset(offset)
      .orderBy("id", "asc");
  },

  /**
   * Get all users for a given chain (for syncing leaderboard from contract).
   */
  async findAllByChain(chain, { limit = 500 } = {}) {
    const normalized = this.normalizeChain(chain);
    return await db("users")
      .where({ chain: normalized })
      .select("id", "username", "address", "games_played", "game_won", "game_lost", "total_staked", "total_earned", "total_withdrawn")
      .limit(Math.min(Number(limit) || 500, 1000));
  },

  /**
   * Update user
   */
  async update(id, userData) {
    await db("users")
      .where({ id })
      .update({
        ...userData,
        updated_at: db.fn.now(),
      });
    return this.findById(id);
  },

  /**
   * Delete user
   */
  async delete(id) {
    return await db("users").where({ id }).del();
  },

  // -------------------------
  // 🎮 Gameplay Stat Helpers
  // -------------------------

  async incrementGamesPlayed(id) {
    await db("users")
      .where({ id })
      .increment("games_played", 1)
      .update({ updated_at: db.fn.now() });
    return this.findById(id);
  },

  async incrementWins(id) {
    await db("users")
      .where({ id })
      .increment("game_won", 1)
      .increment("games_played", 1)
      .update({ updated_at: db.fn.now() });
    return this.findById(id);
  },

  async incrementLosses(id) {
    await db("users")
      .where({ id })
      .increment("game_lost", 1)
      .increment("games_played", 1)
      .update({ updated_at: db.fn.now() });
    return this.findById(id);
  },

  // -------------------------
  // 💰 Financial Helpers
  // -------------------------

  async addStake(id, amount) {
    await db("users")
      .where({ id })
      .increment("total_staked", amount)
      .update({ updated_at: db.fn.now() });
    return this.findById(id);
  },

  async addEarnings(id, amount) {
    await db("users")
      .where({ id })
      .increment("total_earned", amount)
      .update({ updated_at: db.fn.now() });
    return this.findById(id);
  },

  async addWithdrawal(id, amount) {
    await db("users")
      .where({ id })
      .increment("total_withdrawn", amount)
      .update({ updated_at: db.fn.now() });
    return this.findById(id);
  },

  // -------------------------
  // 🏆 Per-chain stats & leaderboards
  // -------------------------

  /**
   * Normalize chain from query (chain name or chainId number) to DB value.
   * Supports: BASE, CELO, POLYGON; 8453/84531 -> BASE, 42220/44787 -> CELO, 137/80001 -> POLYGON.
   */
  normalizeChain(chain) {
    if (chain == null || String(chain).trim() === "") return "BASE";
    const s = String(chain).trim().toUpperCase();
    const n = Number(chain);
    if (s === "BASE" || n === 8453 || n === 84531) return "BASE";
    if (s === "CELO" || n === 42220 || n === 44787) return "CELO";
    if (s === "POLYGON" || n === 137 || n === 80001) return "POLYGON";
    return s;
  },

  /** Column names for per-chain stats (played, won). Only BASE, CELO, POLYGON have columns. */
  chainColumns(normalizedChain) {
    const c = String(normalizedChain || "").toUpperCase();
    if (c === "BASE") return { played: "base_games_played", won: "base_games_won" };
    if (c === "CELO") return { played: "celo_games_played", won: "celo_games_won" };
    if (c === "POLYGON") return { played: "polygon_games_played", won: "polygon_games_won" };
    return null;
  },

  /**
   * Record a finished game for a specific chain: all players get +1 games_played on that chain, winner gets +1 games_won.
   * Call when a game ends with game.chain (e.g. from finishByTime / finishGameByNetWorthAndNotify).
   */
  async recordChainGameResult(chain, winnerId, playerUserIds) {
    const normalized = this.normalizeChain(chain);
    const cols = this.chainColumns(normalized);
    if (!cols) return;
    const { played, won } = cols;
    const winner = Number(winnerId);
    const ids = [...new Set(playerUserIds.map(Number))].filter(Boolean);
    for (const id of ids) {
      try {
        await db("users").where({ id }).increment(played, 1).update({ updated_at: db.fn.now() });
        if (id === winner) {
          await db("users").where({ id }).increment(won, 1).update({ updated_at: db.fn.now() });
        }
      } catch (err) {
        // Skip if user row missing
      }
    }
  },

  /**
   * Top players by games won on this chain (uses per-chain columns: celo_games_won, etc.)
   */
  async getLeaderboardByWins(chain, limit = 20) {
    const normalized = this.normalizeChain(chain);
    const cols = this.chainColumns(normalized);
    if (!cols) {
      return await db("users").where({ chain: normalized }).select("id", "username", "address").limit(0);
    }
    const { played, won } = cols;
    return await db("users")
      .where({ chain: normalized })
      .andWhereRaw("username NOT LIKE ?", ["%AI_%"])
      .select("id", "username", "address", played + " as games_played", won + " as game_won")
      .orderBy(won, "desc")
      .orderBy(played, "desc")
      .limit(Math.min(Number(limit) || 20, 100));
  },

  /**
   * Top players by total earned (filtered by chain)
   */
  async getLeaderboardByEarnings(chain, limit = 20) {
    const normalized = this.normalizeChain(chain);
    return await db("users")
      .where({ chain: normalized })
      .andWhereRaw("username NOT LIKE ?", ["%AI_%"])
      .select("id", "username", "address", "total_earned", "total_staked", "total_withdrawn")
      .orderBy("total_earned", "desc")
      .limit(Math.min(Number(limit) || 20, 100));
  },

  /**
   * Top players by total staked (filtered by chain)
   */
  async getLeaderboardByStakes(chain, limit = 20) {
    const normalized = this.normalizeChain(chain);
    return await db("users")
      .where({ chain: normalized })
      .andWhereRaw("username NOT LIKE ?", ["%AI_%"])
      .select("id", "username", "address", "total_staked", "total_earned", "total_withdrawn")
      .orderBy("total_staked", "desc")
      .limit(Math.min(Number(limit) || 20, 100));
  },

  /**
   * Top players by win rate on this chain (uses per-chain columns; min 1 game on that chain).
   */
  async getLeaderboardByWinRate(chain, limit = 20) {
    const normalized = this.normalizeChain(chain);
    const cols = this.chainColumns(normalized);
    if (!cols) {
      return await db("users").where({ chain: normalized }).select("id", "username", "address").limit(0);
    }
    const { played, won } = cols;
    return await db("users")
      .where({ chain: normalized })
      .andWhereRaw("username NOT LIKE ?", ["%AI_%"])
      .where(played, ">", 0)
      .select(
        "id",
        "username",
        "address",
        db.raw(`${played} AS games_played`),
        db.raw(`${won} AS game_won`),
        db.raw("0 AS game_lost"),
        db.raw(`(CASE WHEN ${played} > 0 THEN (1.0 * ${won} / ${played}) ELSE 0 END) AS win_rate`)
      )
      .orderBy("win_rate", "desc")
      .limit(Math.min(Number(limit) || 20, 100));
  },
};

export default User;
