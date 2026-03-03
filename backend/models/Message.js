import db from "../config/database.js";

const Message = {
  async create(messageData) {
    // Lobby (global) chat: room === "lobby" or game_id === "lobby"
    const isLobby =
      messageData.room === "lobby" ||
      messageData.game_id === "lobby" ||
      String(messageData.game_id || "").toLowerCase() === "lobby";
    if (isLobby) {
      const lobbyChat = await db("chats").where({ slug: "lobby" }).first();
      if (!lobbyChat || lobbyChat.status !== "open") {
        return { error: true, message: "Lobby chat is not available", data: null };
      }
      const userIdRaw = messageData.user_id;
      const addressRaw =
        messageData.address != null && String(messageData.address).trim() !== ""
          ? String(messageData.address).trim()
          : null;
      let userId = userIdRaw != null && userIdRaw !== "" ? Number(userIdRaw) : null;
      if (userId == null && addressRaw) {
        const User = (await import("./User.js")).default;
        const user = await User.resolveUserByAddress(addressRaw);
        if (user) userId = user.id;
      }
      if (userId == null) {
        return { error: true, message: "User identity required for lobby chat", data: null };
      }
      const [id] = await db("messages").insert({
        chat_id: lobbyChat.id,
        player_id: null,
        user_id: userId,
        body: messageData.body,
      });
      const created = await this.findById(id);
      return { error: false, message: "Successful", data: created };
    }

    // Game chat: resolve game by numeric id or by code (frontend may send either).
    // Never use a string code in an id query — MySQL coerces e.g. "ABC123" to 0 and can return the wrong game.
    const gameIdOrCode = messageData.game_id;
    const numericId = gameIdOrCode != null && String(gameIdOrCode).trim() !== "" ? Number(gameIdOrCode) : NaN;
    const isNumericId = Number.isInteger(numericId) && numericId > 0;
    const game =
      (isNumericId ? await db("games").where({ id: numericId }).first() : null) ??
      (await db("games").where({ code: String(gameIdOrCode || "").trim().toUpperCase() }).first());
    if (game && (game.status === "RUNNING" || game.status === "FINISHED")) {
      const playerIdRaw = messageData.player_id;
      const userIdRaw = messageData.user_id;
      const addressRaw = messageData.address != null && String(messageData.address).trim() !== "" ? String(messageData.address).trim() : null;

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
      if (!game_player && addressRaw) {
        game_player = await db("game_players")
          .where({ game_id: game.id })
          .whereRaw("LOWER(TRIM(address)) = ?", [addressRaw.toLowerCase().trim()])
          .first();
      }
      // Fallback: resolve user by address (e.g. mobile/guest sends address but game_players.address may differ or be null)
      if (!game_player && addressRaw) {
        const User = (await import("./User.js")).default;
        const userByAddr = await User.resolveUserByAddress(addressRaw, game.chain);
        if (userByAddr?.id) {
          game_player = await db("game_players")
            .where({ game_id: game.id, user_id: userByAddr.id })
            .first();
        }
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
    // Support both game id (number) and game code (string); avoid using string code in id query
    const numericId = gameIdOrCode != null && String(gameIdOrCode).trim() !== "" ? Number(gameIdOrCode) : NaN;
    const isNumericId = Number.isInteger(numericId) && numericId > 0;
    const game =
      (isNumericId ? await db("games").where({ id: numericId }).first() : null) ??
      (await db("games").where({ code: String(gameIdOrCode || "").trim().toUpperCase() }).first());
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

  async findAllByLobby() {
    const lobbyChat = await db("chats").where({ slug: "lobby" }).first();
    if (!lobbyChat) return [];
    const rows = await db("messages as m")
      .leftJoin("users as u", "m.user_id", "u.id")
      .where({ "m.chat_id": lobbyChat.id })
      .orderBy("m.id", "asc")
      .select("m.id", "m.body", "m.player_id", "m.user_id", "m.created_at", "u.username");
    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      player_id: String(r.player_id ?? ""),
      user_id: r.user_id ?? null,
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
