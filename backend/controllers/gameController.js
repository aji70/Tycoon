import Game from "../models/Game.js";
import GameSetting from "../models/GameSetting.js";
import GamePlayer from "../models/GamePlayer.js";
import User from "../models/User.js";
import GamePlayHistory from "../models/GamePlayHistory.js";
import Chat from "../models/Chat.js";
import db from "../config/database.js";
import { recordEvent } from "../services/analytics.js";

const PROPERTY_TYPES = {
  RAILWAY: [5, 15, 25, 35],
  UTILITY: [12, 28],
};
const RAILWAY_RENT = { 1: 25, 2: 50, 3: 100, 4: 200 };
const UTILITY_MULTIPLIER = { 1: 4, 2: 10 };
const AVERAGE_DICE_ROLL = 7;

/**
 * Compute winner by net worth: cash + property values (incl. mortgage) + building resale value + one-turn rent potential.
 * Does not modify DB.
 * @returns { winner_id, net_worths: [{ user_id, net_worth }] } or null if game invalid
 */
async function computeWinnerByNetWorth(game) {
  if (!game?.is_ai || game?.status !== "RUNNING") return null;
  const players = await db("game_players").where({ game_id: game.id }).select("id", "user_id", "balance", "turn_count");
  if (players.length === 0) return null;

  const rows = await db("game_properties as gp")
    .join("properties as p", "gp.property_id", "p.id")
    .where("gp.game_id", game.id)
    .whereNotNull("gp.player_id")
    .select(
      "gp.player_id",
      "gp.property_id",
      "gp.development",
      "gp.mortgaged",
      "p.price",
      "p.cost_of_house",
      "p.rent_site_only",
      "p.rent_one_house",
      "p.rent_two_houses",
      "p.rent_three_houses",
      "p.rent_four_houses",
      "p.rent_hotel"
    );

  const byPlayerId = new Map();
  for (const row of rows) byPlayerId.set(row.player_id, [...(byPlayerId.get(row.player_id) || []), row]);

  function oneTurnRent(gp, ownedByThisPlayer) {
    if (Number(gp.mortgaged)) return 0;
    if (PROPERTY_TYPES.RAILWAY.includes(gp.property_id)) {
      const count = ownedByThisPlayer.filter((o) => PROPERTY_TYPES.RAILWAY.includes(o.property_id)).length;
      return RAILWAY_RENT[count] || 0;
    }
    if (PROPERTY_TYPES.UTILITY.includes(gp.property_id)) {
      const count = ownedByThisPlayer.filter((o) => PROPERTY_TYPES.UTILITY.includes(o.property_id)).length;
      return AVERAGE_DICE_ROLL * (UTILITY_MULTIPLIER[count] || 0);
    }
    const dev = Math.min(5, Math.max(0, Number(gp.development || 0)));
    const rents = [
      gp.rent_site_only,
      gp.rent_one_house,
      gp.rent_two_houses,
      gp.rent_three_houses,
      gp.rent_four_houses,
      gp.rent_hotel,
    ];
    return Number(rents[dev] || 0);
  }

  const net_worths = [];
  let best = { user_id: null, net_worth: -1 };
  for (const player of players) {
    const cash = Number(player.balance) || 0;
    const owned = byPlayerId.get(player.id) || [];
    let propertyValue = 0;
    let buildingValue = 0;
    let rentTotal = 0;
    for (const gp of owned) {
      const price = Number(gp.price) || 0;
      propertyValue += Number(gp.mortgaged) ? Math.floor(price / 2) : price;
      // Building resale value (half cost when sold back to bank); development 0–5 = 0–4 houses or hotel
      const dev = Math.min(5, Math.max(0, Number(gp.development || 0)));
      const costOfHouse = Number(gp.cost_of_house) || 0;
      buildingValue += Math.floor(dev * costOfHouse / 2);
      rentTotal += oneTurnRent(gp, owned);
    }
    const net_worth = cash + propertyValue + buildingValue + rentTotal;
    net_worths.push({ user_id: player.user_id, net_worth });
    if (net_worth > best.net_worth) {
      const winnerTurnCount = Number(player.turn_count || 0);
      best = { 
        user_id: player.user_id, 
        net_worth,
        turn_count: winnerTurnCount,
        valid_win: winnerTurnCount >= 20 // Valid win requires >= 20 turns
      };
    }
  }
  return { 
    winner_id: best.user_id, 
    net_worths,
    winner_turn_count: best.turn_count || 0,
    valid_win: best.valid_win !== false // Default to true if not set
  };
}

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

      await recordEvent("game_created", {
        entityType: "game",
        entityId: game.id,
        payload: { is_ai: game.is_ai },
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

  /**
   * GET: Return winner by net worth without modifying the game (for time-up UI).
   * Only valid when game is RUNNING and time has elapsed.
   */
  async getWinnerByNetWorth(req, res) {
    try {
      const game = await Game.findById(req.params.id);
      if (!game) return res.status(404).json({ success: false, error: "Game not found" });
      if (!game.is_ai) return res.status(400).json({ success: false, error: "Not an AI game" });
      if (game.status !== "RUNNING") return res.status(400).json({ success: false, error: "Game is not running" });

      const durationMinutes = Number(game.duration) || 0;
      if (durationMinutes <= 0) return res.status(400).json({ success: false, error: "Game has no duration" });

      const endMs = new Date(game.created_at).getTime() + durationMinutes * 60 * 1000;
      if (Date.now() < endMs) return res.status(400).json({ success: false, error: "Game time has not ended yet" });

      const result = await computeWinnerByNetWorth(game);
      if (!result) return res.status(400).json({ success: false, error: "Could not compute winner" });

      return res.status(200).json({
        success: true,
        data: { 
          winner_id: result.winner_id, 
          net_worths: result.net_worths,
          winner_turn_count: result.winner_turn_count || 0,
          valid_win: result.valid_win !== false // Valid if >= 20 turns
        },
      });
    } catch (error) {
      console.error("getWinnerByNetWorth error:", error);
      return res.status(500).json({ success: false, message: error?.message || "Failed to get winner" });
    }
  },

  /**
   * POST: End AI game by time; set winner by net worth (called when AI wins and we need backend updated).
   */
  async finishByTime(req, res) {
    try {
      const game = await Game.findById(req.params.id);
      if (!game) return res.status(404).json({ success: false, error: "Game not found" });
      if (!game.is_ai) return res.status(400).json({ success: false, error: "Not an AI game" });
      // Idempotent: if already finished (e.g. other player already claimed), return success so both winner and loser can "finish" after claiming on-chain
      if (game.status === "FINISHED" || game.status === "CANCELLED") {
        return res.status(200).json({
          success: true,
          message: "Game already concluded",
          data: { game, winner_id: game.winner_id },
        });
      }
      if (game.status !== "RUNNING") return res.status(400).json({ success: false, error: "Game is not running" });

      const durationMinutes = Number(game.duration) || 0;
      if (durationMinutes <= 0) return res.status(400).json({ success: false, error: "Game has no duration" });

      const endMs = new Date(game.created_at).getTime() + durationMinutes * 60 * 1000;
      if (Date.now() < endMs) return res.status(400).json({ success: false, error: "Game time has not ended yet" });

      const result = await computeWinnerByNetWorth(game);
      if (!result || result.winner_id == null) return res.status(400).json({ success: false, error: "Could not compute winner" });

      await Game.update(game.id, { status: "FINISHED", winner_id: result.winner_id });
      const updated = await Game.findById(game.id);
      return res.status(200).json({
        success: true,
        message: "Game finished by time; winner by net worth",
        data: { 
          game: updated, 
          winner_id: result.winner_id,
          winner_turn_count: result.winner_turn_count || 0,
          valid_win: result.valid_win !== false // Valid if >= 20 turns
        },
      });
    } catch (error) {
      console.error("finishByTime error:", error);
      return res.status(500).json({ success: false, message: error?.message || "Failed to finish game by time" });
    }
  },

  // -------------------------
  // 🔹 Extra Endpoints
  // -------------------------

  async findByCode(req, res) {
    try {
      const game = await Game.findByCode(req.params.code);
      if (!game) return res.status(404).json({ error: "Game not found" });
      if (game.status === "FINISHED" || game.status === "CANCELLED") {
        return res.status(200).json({ success: false, error: "Game ended" });
      }
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

    await recordEvent("game_created", {
      entityType: "game",
      entityId: game.id,
      payload: { is_ai: game.is_ai },
    });

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
      // Set turn_start for the first player (90s roll timer)
      if (updatedGame.next_player_id) {
        await GamePlayer.setTurnStart(game.id, updatedGame.next_player_id);
      }
      const playersWithTurnStart = await GamePlayer.findByGameId(game.id);

      io.to(game.code).emit("game-ready", {
        game: updatedGame,
        players: playersWithTurnStart,
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
