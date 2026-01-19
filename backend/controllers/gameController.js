import Game from "../models/Game.js";
import GameSetting from "../models/GameSetting.js";
import GamePlayer from "../models/GamePlayer.js";
import User from "../models/User.js";
import GamePlayHistory from "../models/GamePlayHistory.js";
import Chat from "../models/Chat.js";

/**
 * Game Controller
 *
 * Handles requests related to game sessions.
 */
const gameController = {
  // -------------------------
  // 🔹 CRUD
  // -------------------------

  async create(req, res) {
    try {
      const {
        code,
        mode,
        address,
        symbol,
        number_of_players,
        settings,
        is_minipay,
        is_ai,
        duration,
        chain,
      } = req.body;
      const user = await User.findByAddress(address);
      if (!user) {
        return res
          .status(200)
          .json({ success: false, message: "User not found" });
      }
      // check if code exist
      // create game on contract : code, mode, address, no_of_players, status, players_joined
      const game = await Game.create({
        code,
        mode,
        creator_id: user.id,
        next_player_id: user.id,
        number_of_players,
        status: "PENDING",
        is_minipay,
        is_ai,
        duration,
        chain,
      });

      const chat = await Chat.create({
        game_id: game.id,
        status: "open",
      });

      const gameSettingsPayload = {
        game_id: game.id,
        auction: settings.auction,
        rent_in_prison: settings.rent_in_prison,
        mortgage: settings.mortgage,
        even_build: settings.even_build,
        randomize_play_order: settings.randomize_play_order,
        starting_cash: settings.starting_cash,
        // turn_start: settings.turn_start,
      };

      const game_settings = await GameSetting.create(gameSettingsPayload);

      const gamePlayersPayload = {
        game_id: game.id,
        user_id: user.id,
        address: user.address,
        balance: settings.starting_cash,
        position: 0,
        turn_order: 1,
        symbol: symbol,
        chance_jail_card: false,
        community_chest_jail_card: false,
      };

      const add_to_game_players = await GamePlayer.create(gamePlayersPayload);

      const game_players = await GamePlayer.findByGameId(game.id);

      res.status(201).json({
        success: true,
        message: "successful",
        data: {
          ...game,
          settings: game_settings,
          players: game_players,
        },
      });
    } catch (error) {
      console.error("Error creating game with settings:", error);
      res.status(200).json({ success: false, message: error.message });
    }
  },

  async findById(req, res) {
    try {
      const game = await Game.findById(req.params.id);
      if (!game) return res.status(404).json({ error: "Game not found" });

      // Attach settings
      const settings = await GameSetting.findByGameId(game.id);
      const players = await GamePlayer.findByGameId(game.id);

      res.json({
        success: true,
        message: "successful",
        data: { ...game, settings, players },
      });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const { limit, offset } = req.query;
      const games = await Game.findAll({
        limit: Number.parseInt(limit) || 10000,
        offset: Number.parseInt(offset) || 0,
      });

      // Eager load settings for each game
      const withSettingsAndPlayers = await Promise.all(
        games.map(async (g) => ({
          ...g,
          settings: await GameSetting.findByGameId(g.id),
          players: await GamePlayer.findByGameId(g.id),
        }))
      );

      res.json({
        success: true,
        message: "successful",
        data: withSettingsAndPlayers,
      });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },

  async update(req, res) {
    try {
      await Game.update(req.params.id, req.body);
      res.json({ success: true, message: "Game updated" });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },

  async remove(req, res) {
    try {
      await Game.delete(req.params.id);
      res.json({ success: true, message: "Game deleted" });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },

  // -------------------------
  // 🔹 Extra Endpoints
  // -------------------------

  async findByCode(req, res) {
    try {
      const game = await Game.findByCode(req.params.code);
      if (!game) return res.status(404).json({ error: "Game not found" });
      const settings = await GameSetting.findByGameId(game.id);
      const players = await GamePlayer.findByGameId(game.id);
      const history = await GamePlayHistory.findByGameId(game.id);

      res.json({
        success: true,
        message: "successful",
        data: { ...game, settings, players, history },
      });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },

  async findByWinner(req, res) {
    try {
      const { limit, offset } = req.query;
      const games = await Game.findByWinner(req.params.userId, {
        limit: Number.parseInt(limit) || 50,
        offset: Number.parseInt(offset) || 0,
      });
      res.json({
        success: true,
        message: "successful",
        data: games,
      });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },

  async findByCreator(req, res) {
    try {
      const { limit, offset } = req.query;
      const games = await Game.findByCreator(req.params.userId, {
        limit: Number.parseInt(limit) || 50,
        offset: Number.parseInt(offset) || 0,
      });
      res.json({
        success: true,
        message: "successful",
        data: games,
      });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },
  async findActive(req, res) {
    try {
      const { limit, offset, timeframe } = req.query;

      const games = await Game.findActiveGames({
        limit: Number.parseInt(limit) || 50,
        offset: Number.parseInt(offset) || 0,
        timeframe: timeframe ? Number(timeframe) : null,
      });

      const withSettingsAndPlayers = await Promise.all(
        games.map(async (g) => ({
          ...g,
          settings: await GameSetting.findByGameId(g.id),
          players: await GamePlayer.findByGameId(g.id),
        }))
      );

      res.json({
        success: true,
        message: "successful",
        data: withSettingsAndPlayers,
      });
    } catch (error) {
      res.status(200).json({
        success: false,
        message: error.message,
      });
    }
  },

  async findPending(req, res) {
    try {
      const { limit, offset } = req.query;
      const games = await Game.findPendingGames({
        limit: Number.parseInt(limit) || 50,
        offset: Number.parseInt(offset) || 0,
      });
      // Eager load settings for each game
      const withSettingsAndPlayers = await Promise.all(
        games.map(async (g) => ({
          ...g,
          settings: await GameSetting.findByGameId(g.id),
          players: await GamePlayer.findByGameId(g.id),
        }))
      );

      res.json({
        success: true,
        message: "successful",
        data: withSettingsAndPlayers,
      });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },
};

export const create = async (req, res) => {
  try {
    const {
      code,
      mode,
      address,
      symbol,
      number_of_players,
      settings,
      is_minipay,
      is_ai,
      duration,
      chain,
    } = req.body;
    const user = await User.findByAddress(address);
    if (!user) {
      return res
        .status(200)
        .json({ success: false, message: "User not found" });
    }

    // Check if game code already exists
    const existingGame = await Game.findByCode(code);
    if (existingGame) {
      return res
        .status(200)
        .json({ success: false, message: "Game code already exists" });
    }

    const game = await Game.create({
      code,
      mode,
      creator_id: user.id,
      next_player_id: user.id,
      number_of_players,
      status: "PENDING",
      is_minipay,
      is_ai,
      duration,
      chain,
    });

    const gameSettingsPayload = {
      game_id: game.id,
      auction: settings.auction,
      rent_in_prison: settings.rent_in_prison,
      mortgage: settings.mortgage,
      even_build: settings.even_build,
      randomize_play_order: settings.randomize_play_order,
      starting_cash: settings.starting_cash,
    };

    const game_settings = await GameSetting.create(gameSettingsPayload);

    const gamePlayersPayload = {
      game_id: game.id,
      user_id: user.id,
      address: user.address,
      balance: settings.starting_cash,
      position: 0,
      turn_order: 1,
      symbol: symbol,
      chance_jail_card: false,
      community_chest_jail_card: false,
    };

    const add_to_game_players = await GamePlayer.create(gamePlayersPayload);

    const game_players = await GamePlayer.findByGameId(game.id);

    // Emit game created event
    const io = req.app.get("io");
    io.to(game.code).emit("game-created", {
      game: { ...game, settings: game_settings, players: game_players },
    });

    res.status(201).json({
      success: true,
      message: "successful",
      data: {
        ...game,
        settings: game_settings,
        players: game_players,
      },
    });
  } catch (error) {
    console.error("Error creating game with settings:", error);
    res.status(200).json({ success: false, message: error.message });
  }
};

export const join = async (req, res) => {
  try {
    const { address, code, symbol } = req.body;

    // find user
    const user = await User.findByAddress(address);
    if (!user) {
      return res
        .status(200)
        .json({ success: false, message: "User not found" });
    }

    // find game
    const game = await Game.findByCode(code);
    if (!game) {
      return res
        .status(200)
        .json({ success: false, message: "Game not found" });
    }

    // Check if game is full
    const currentPlayers = await GamePlayer.findByGameId(game.id);
    if (currentPlayers.length >= game.number_of_players) {
      return res.status(200).json({ success: false, message: "Game is full" });
    }

    // Check if user is already in the game
    const existingPlayer = currentPlayers.find(
      (player) => player.user_id === user.id
    );
    if (existingPlayer) {
      return res
        .status(200)
        .json({ success: false, message: "Player already in game" });
    }

    // find settings
    const settings = await GameSetting.findByGameId(game.id);
    if (!settings) {
      return res
        .status(200)
        .json({ success: false, message: "Game settings not found" });
    }

    // find max turn order
    const maxTurnOrder =
      currentPlayers.length > 0
        ? Math.max(...currentPlayers.map((p) => p.turn_order || 0))
        : 0;

    // assign next turn_order
    const nextTurnOrder = maxTurnOrder + 1;

    // create new player
    const player = await GamePlayer.create({
      address,
      symbol,
      user_id: user.id,
      game_id: game.id,
      balance: settings.starting_cash,
      position: 0,
      chance_jail_card: false,
      community_chest_jail_card: false,
      turn_order: nextTurnOrder,
      circle: 0,
      rolls: 0,
    });

    // Get updated players list
    const updatedPlayers = await GamePlayer.findByGameId(game.id);

    // Emit player joined event
    const io = req.app.get("io");
    io.to(game.code).emit("player-joined", {
      player: player,
      players: updatedPlayers,
      game: game,
    });

    // If game is now full, update status and emit
    if (updatedPlayers.length === game.number_of_players) {
      await Game.update(game.id, { status: "RUNNING" });
      const updatedGame = await Game.findByCode(code);

      io.to(game.code).emit("game-ready", {
        game: updatedGame,
        players: updatedPlayers,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Player added to game successfully",
      data: player,
    });
  } catch (error) {
    console.error("Error creating game player:", error);
    return res.status(200).json({ success: false, message: error.message });
  }
};

export const leave = async (req, res) => {
  try {
    const { address, code } = req.body;
    const user = await User.findByAddress(address);
    if (!user) {
      return res
        .status(200)
        .json({ success: false, message: "User not found" });
    }

    const game = await Game.findByCode(code);
    if (!game) {
      return res
        .status(200)
        .json({ success: false, message: "Game not found" });
    }

    const player = await GamePlayer.leave(game.id, user.id);

    // Get updated players list
    const updatedPlayers = await GamePlayer.findByGameId(game.id);

    // Emit player left event
    const io = req.app.get("io");
    io.to(game.code).emit("player-left", {
      player: player,
      players: updatedPlayers,
      game: game,
    });

    // If no players left, delete the game
    if (updatedPlayers.length === 0) {
      await Game.delete(game.id);
      io.to(game.code).emit("game-ended", { gameCode: code });
    }

    res.status(200).json({
      success: true,
      message: "Player removed from game successfully",
    });
  } catch (error) {
    console.error("Error removing game player:", error);
    res.status(200).json({ success: false, message: error.message });
  }
};

export default gameController;
