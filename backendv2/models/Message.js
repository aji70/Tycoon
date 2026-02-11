import db from "../config/database.js";

const Message = {
  async create(messageData) {
    const game = await db("games").where({ id: messageData.game_id }).first();
    if (game && game.status === "RUNNING") {
      const game_player = await db("game_players")
        .where({ game_id: game.id, id: messageData.player_id })
        .first();
      if (game_player) {
        const chat = await db("chats").where({ game_id: game.id }).first();
        if (chat && chat.status === "open") {
          const [id] = await db("messages").insert(messageData);
          return {
            error: false,
            message: "Successful",
            data: this.findById(id),
          };
        }
        return {
          error: true,
          message: "Game chat room does not exist",
          data: null,
        };
      }
      return { error: true, message: "Player not in game", data: null };
    }
    return {
      error: true,
      message: "Game not found or not running",
      data: null,
    };
  },

  async findAll() {
    return await db("messages").orderBy("id", "asc");
  },

  async find(id) {
    return await db("messages").where({ id }).first();
  },

  async findById(id) {
    return await db("messages").where({ id }).first();
  },

  async findAllByMessagesByChatId(chat_id) {
    return await db("messages").where({ chat_id }).orderBy("id", "asc");
  },

  async findAllByMessagesByGameId(game_id) {
    const chat = await db("chat").where({ game_id }).first();
    if (chat) {
      return await db("messages")
        .where({ chat_id: chat.id })
        .orderBy("id", "asc");
    }
    return [];
  },

  async update(id, messageData) {
    await db("messages").where({ id }).update(messageData);
    return this.findById(id);
  },

  async delete(id) {
    return await db("messages").where({ id }).del();
  },
};

export default Message;
