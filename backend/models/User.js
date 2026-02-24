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
  // 🏆 Leaderboards (by chain)
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

  /**
   * Top players by games won (filtered by chain)
   */
  async getLeaderboardByWins(chain, limit = 20) {
    const normalized = this.normalizeChain(chain);
    return await db("users")
      .where({ chain: normalized })
      .select("id", "username", "address", "games_played", "game_won", "game_lost")
      .orderBy("game_won", "desc")
      .orderBy("games_played", "desc")
      .limit(Math.min(Number(limit) || 20, 100));
  },

  /**
   * Top players by total earned (filtered by chain)
   */
  async getLeaderboardByEarnings(chain, limit = 20) {
    const normalized = this.normalizeChain(chain);
    return await db("users")
      .where({ chain: normalized })
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
      .select("id", "username", "address", "total_staked", "total_earned", "total_withdrawn")
      .orderBy("total_staked", "desc")
      .limit(Math.min(Number(limit) || 20, 100));
  },

  /**
   * Top players by win rate, min 1 game (filtered by chain)
   */
  async getLeaderboardByWinRate(chain, limit = 20) {
    const normalized = this.normalizeChain(chain);
    return await db("users")
      .where({ chain: normalized })
      .where("games_played", ">", 0)
      .select(
        "id",
        "username",
        "address",
        "games_played",
        "game_won",
        "game_lost",
        db.raw("(CASE WHEN games_played > 0 THEN (1.0 * game_won / games_played) ELSE 0 END) AS win_rate")
      )
      .orderBy("win_rate", "desc")
      .limit(Math.min(Number(limit) || 20, 100));
  },
};

export default User;
