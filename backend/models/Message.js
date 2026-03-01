import db from "../config/database.js";

const Message = {
  async create(messageData) {
    // Support both game id (number) and game code (string)
    const gameIdOrCode = messageData.game_id;
    const game =
      (await db("games").where({ id: gameIdOrCode }).first()) ??
      (await db("games").where({ code: String(gameIdOrCode) }).first());
    if (game && game.status === "RUNNING") {
      const playerIdRaw = messageData.player_id;
      const userIdRaw = messageData.user_id;
      const playerIdNum = playerIdRaw != null && playerIdRaw !== "" ? Number(playerIdRaw) : NaN;
      const userIdNum = userIdRaw != null && userIdRaw !== "" ? Number(userIdRaw) : NaN;

      let game_player = null;
      if (Number.isInteger(playerIdNum) && playerIdNum > 0) {
        game_player = await db("game_players")
          .where({ game_id: game.id, id: playerIdNum })
          .first();
      }
      if (!game_player && Number.isInteger(userIdNum) && userIdNum > 0) {
        game_player = await db("game_players")
          .where({ game_id: game.id, user_id: userIdNum })
          .first();
      }
      if (game_player) {
        const chat = await db("chats").where({ game_id: game.id }).first();
        if (chat && chat.status === "open") {
          const insertData = {
            chat_id: chat.id,
            player_id: String(game_player.id),
            body: messageData.body,
          };
          const [id] = await db("messages").insert(insertData);
          const created = await this.findById(id);
          return {
            error: false,
            message: "Successful",
            data: created,
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

  async findAllByMessagesByGameId(gameIdOrCode) {
    // Support both game id (number) and game code (string)
    const game =
      (await db("games").where({ id: gameIdOrCode }).first()) ??
      (await db("games").where({ code: String(gameIdOrCode) }).first());
    if (!game) return [];
    const chat = await db("chats").where({ game_id: game.id }).first();
    if (!chat) return [];
    const rows = await db("messages as m")
      .leftJoin("game_players as gp", db.raw("gp.id = m.player_id"))
      .leftJoin("users as u", "gp.user_id", "u.id")
      .where({ "m.chat_id": chat.id })
      .orderBy("m.id", "asc")
      .select("m.id", "m.body", "m.player_id", "m.created_at", "u.username");
    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      player_id: String(r.player_id ?? ""),
      created_at: r.created_at,
      username: r.username ?? null,
    }));
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
