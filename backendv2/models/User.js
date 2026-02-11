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
   * Find by username
   */
  async findByUsername(username) {
    return await db("users").where({ username }).first();
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
  // 🏆 Leaderboards
  // -------------------------

  /**
   * Top players by games won
   */
  async leaderboardByWins(limit = 10) {
    return await db("users")
      .select("id", "username", "games_played", "game_won", "game_lost")
      .orderBy("game_won", "desc")
      .limit(limit);
  },

  /**
   * Top players by earnings
   */
  async leaderboardByEarnings(limit = 10) {
    return await db("users")
      .select(
        "id",
        "username",
        "total_earned",
        "total_staked",
        "total_withdrawn"
      )
      .orderBy("total_earned", "desc")
      .limit(limit);
  },

  /**
   * Top players by staked amount
   */
  async leaderboardByStakes(limit = 10) {
    return await db("users")
      .select(
        "id",
        "username",
        "total_staked",
        "total_earned",
        "total_withdrawn"
      )
      .orderBy("total_staked", "desc")
      .limit(limit);
  },

  /**
   * Win ratio leaderboard (wins / games played)
   */
  async leaderboardByWinRate(limit = 10) {
    return await db("users")
      .select(
        "id",
        "username",
        "games_played",
        "game_won",
        "game_lost",
        db.raw(
          "CASE WHEN games_played > 0 THEN game_won / games_played ELSE 0 END as win_rate"
        )
      )
      .orderBy("win_rate", "desc")
      .limit(limit);
  },
};

export default User;
