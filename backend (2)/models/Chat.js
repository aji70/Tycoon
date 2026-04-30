import db from "../config/database.js";

const Chat = {
  async create(chatData) {
    const [id] = await db("chats").insert(chatData);
    return this.findById(id);
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
