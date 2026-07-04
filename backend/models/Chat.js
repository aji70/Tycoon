import db from "../config/database.js";

const Chat = {
  async create(chatData) {
    const [id] = await db("chats").insert(chatData);
    return this.findById(id);
  },

  /** Idempotent game chat row. Does not throw by default so game creation is never blocked. */
  async ensureForGame(gameId, options = {}) {
    const { required = false } = options;
    if (gameId == null) return null;

    const existing = await db("chats").where({ game_id: gameId }).first();
    if (existing) return existing;

    try {
      const [id] = await db("chats").insert({ game_id: gameId, status: "open" });
      return this.findById(id);
    } catch (err) {
      if (required) throw err;
      return null;
    }
  },

  async findAll() {
    return await db("chats").orderBy("id", "asc");
  },

  async find(id) {
    return await db("chats").where({ id }).first();
  },

  async findById(id) {
    return await db("chats").where({ id }).first();
  },

  async findByGameId(game_id) {
    return await db("chats").where({ game_id }).first();
  },

  async update(id, chatData) {
    await db("chats").where({ id }).update(chatData);
    return this.findById(id);
  },

  async updateByGameId(game_id, chatData) {
    await db("chats").where({ game_id }).update(chatData);
    return this.findByGameId(id);
  },

  async delete(id) {
    return await db("chats").where({ id }).del();
  },
  
  async deleteByGameId(game_id) {
    return await db("chats").where({ game_id }).del();
  },
};

export default Chat;
