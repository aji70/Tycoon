import Game from "../models/Game.js";
import GameSetting from "../models/GameSetting.js";
import GamePlayer from "../models/GamePlayer.js";
import User from "../models/User.js";
import GamePlayHistory from "../models/GamePlayHistory.js";
import Chat from "../models/Chat.js";
import db from "../config/database.js";
import { recordEvent } from "../services/analytics.js";
import {
  getCachedGameByCode,
  setCachedGameByCode,
  invalidateGameById,
  invalidateGameByCode,
} from "../utils/gameCache.js";
import { emitGameUpdate } from "../utils/socketHelpers.js";
import logger from "../config/logger.js";
import {
  createGameByBackend,
  joinGameByBackend,
  createAIGameByBackend,
  callContractRead,
  endAIGameByBackend,
  exitGameByBackend,
  isContractConfigured,
} from "../services/tycoonContract.js";
import { ensureUserHasContractPassword } from "../utils/ensureContractAuth.js";

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
  if (!game || game?.status !== "RUNNING") return null;
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
        id: contractGameId,
      } = req.body;
      const user = await User.findByAddress(address);
      if (!user) {
        return res
          .status(200)
          .json({ success: false, message: "User not found" });
      }
      // create game (frontend sends on-chain game id as id for contract integration)
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
        contract_game_id: contractGameId != null ? String(contractGameId) : null,
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
      logger.error({ err: error }, "Error creating game with settings");
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
      await invalidateGameById(req.params.id);
      const io = req.app.get("io");
      const game = await Game.findById(req.params.id);
      if (game?.code) emitGameUpdate(io, game.code);
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
      logger.error({ err: error }, "getWinnerByNetWorth error");
      return res.status(500).json({ success: false, message: error?.message || "Failed to get winner" });
    }
  },

  /**
   * POST: End game by time (AI or multiplayer); set winner by net worth.
   * Backend assigns winner (DB FINISHED + winner_id) before the frontend shows winner/loser modals.
   * Optionally end AI game on the contract (e.g. endAIGameByBackend) when integrated.
   */
  async finishByTime(req, res) {
    try {
      const game = await Game.findById(req.params.id);
      if (!game) return res.status(404).json({ success: false, error: "Game not found" });
      // Idempotent: if already finished, return success so frontend can show modal with winner_id
      if (game.status === "FINISHED" || game.status === "CANCELLED") {
        const settings = await GameSetting.findByGameId(game.id);
        const players = await GamePlayer.findByGameId(game.id);
        const fullGame = { ...game, settings, players };
        return res.status(200).json({
          success: true,
          message: "Game already concluded",
          data: { game: fullGame, winner_id: game.winner_id, valid_win: true },
        });
      }
      if (game.status !== "RUNNING") return res.status(400).json({ success: false, error: "Game is not running" });

      const durationMinutes = Number(game.duration) || 0;
      if (durationMinutes <= 0) return res.status(400).json({ success: false, error: "Game has no duration" });

      const startAt = game.started_at || game.created_at;
      const endMs = new Date(startAt).getTime() + durationMinutes * 60 * 1000;
      // Allow from 3s before end; any time after that is OK (countdown fires at 0; clock skew may make server slightly behind).
      if (Date.now() < endMs - 3000) return res.status(400).json({ success: false, error: "Game time has not ended yet" });

      const result = await computeWinnerByNetWorth(game);
      if (!result || result.winner_id == null) return res.status(400).json({ success: false, error: "Could not compute winner" });

      // Mark DB FINISHED and announce winner first so the UI always shows the winner, even if contract calls fail.
      await Game.update(game.id, { status: "FINISHED", winner_id: result.winner_id });
      await invalidateGameById(game.id);
      const io = req.app.get("io");
      if (io) emitGameUpdate(io, game.code);

      // Best-effort: end game on contract (payouts / exit order). Failures are logged; game is already finished in DB.
      let contractGameIdToUse = game.contract_game_id;
      if (!game.is_ai && isContractConfigured() && game.code) {
        if (!contractGameIdToUse) {
          try {
            const contractGame = await callContractRead("getGameByCode", [(game.code || "").trim().toUpperCase()]);
            const onChainId = contractGame?.id ?? contractGame?.[0];
            if (onChainId != null && onChainId !== "") {
              contractGameIdToUse = String(onChainId);
              await Game.update(game.id, { contract_game_id: contractGameIdToUse });
            }
          } catch (err) {
            logger.warn({ err: err?.message, gameId: game.id, code: game.code }, "getGameByCode in finishByTime failed");
          }
        }
      }
      if (contractGameIdToUse && isContractConfigured()) {
        if (game.is_ai) {
          const creator = await ensureUserHasContractPassword(db, game.creator_id) ||
            (await db("users").where({ id: game.creator_id }).select("address", "username", "password_hash").first());
          const humanGp = await db("game_players").where({ game_id: game.id, user_id: game.creator_id }).select("position", "balance").first();
          if (creator?.address && creator?.password_hash && humanGp) {
            const isWin = result.winner_id === game.creator_id;
            await endAIGameByBackend(
              creator.address,
              creator.username || "",
              creator.password_hash,
              contractGameIdToUse,
              Number(humanGp.position ?? 0),
              String(humanGp.balance ?? 0),
              isWin
            ).catch((err) => logger.warn({ err: err?.message, gameId: game.id }, "endAIGameByBackend failed (game already ended on-chain?)"));
          }
        } else {
          const sortedByNetWorth = [...(result.net_worths || [])].sort((a, b) => (a.net_worth ?? 0) - (b.net_worth ?? 0));
          for (const { user_id } of sortedByNetWorth) {
            const user = await ensureUserHasContractPassword(db, user_id) ||
              (await db("users").where({ id: user_id }).select("address", "username", "password_hash").first());
            if (!user?.address || !user?.password_hash) {
              logger.warn({ gameId: game.id, user_id }, "finishByTime: skipping exit (no contract auth for player)");
              continue;
            }
            try {
              await exitGameByBackend(
                user.address,
                user.username || "",
                user.password_hash,
                contractGameIdToUse
              );
            } catch (err) {
              logger.warn({ err: err?.message, gameId: game.id, user_id }, "finishByTime: exitGameByBackend failed for player");
            }
          }
        }
      }

      const updated = await Game.findById(game.id);
      const settings = await GameSetting.findByGameId(game.id);
      const players = await GamePlayer.findByGameId(game.id);
      const fullGame = { ...updated, settings, players };
      return res.status(200).json({
        success: true,
        message: "Game finished by time; winner by net worth",
        data: {
          game: fullGame,
          winner_id: result.winner_id,
          winner_turn_count: result.winner_turn_count || 0,
          valid_win: result.valid_win !== false // Valid if >= 20 turns
        },
      });
    } catch (error) {
      logger.error({ err: error }, "finishByTime error");
      return res.status(500).json({ success: false, message: error?.message || "Failed to finish game by time" });
    }
  },

  // -------------------------
  // 🔹 Extra Endpoints
  // -------------------------

  async findByCode(req, res) {
    try {
      const code = req.params.code;
      const cached = await getCachedGameByCode(code);
      if (cached) {
        return res.json({
          success: true,
          message: "successful",
          data: cached,
        });
      }

      const game = await Game.findByCode(code);
      if (!game) return res.status(404).json({ error: "Game not found" });
      // Return full game data for FINISHED/CANCELLED so the board can show winner modal; no "Game ended" error that would replace the page.
      const settings = await GameSetting.findByGameId(game.id);
      const players = await GamePlayer.findByGameId(game.id);
      const history = await GamePlayHistory.findByGameId(game.id);
      const data = { ...game, settings, players, history };
      await setCachedGameByCode(code, data);

      res.json({
        success: true,
        message: "successful",
        data,
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
    logger.error({ err: error }, "Error creating game with settings");
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

    const io = req.app.get("io");
    await invalidateGameByCode(code);
    emitGameUpdate(io, game.code);
    io.to(game.code).emit("player-joined", {
      player: player,
      players: updatedPlayers,
      game: game,
    });

    if (updatedPlayers.length === game.number_of_players) {
      await Game.update(game.id, { status: "RUNNING", started_at: db.fn.now() });
      await invalidateGameById(game.id);
      const updatedGame = await Game.findByCode(code);
      // Set turn_start for the first player (90s roll timer)
      if (updatedGame.next_player_id) {
        await GamePlayer.setTurnStart(game.id, updatedGame.next_player_id);
      }
      const playersWithTurnStart = await GamePlayer.findByGameId(game.id);

      emitGameUpdate(io, game.code);
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
    logger.error({ err: error }, "Error creating game player");
    return res.status(200).json({ success: false, message: error.message });
  }
};

/**
 * POST /games/create-as-guest
 * Body: same as POST /games but without address (use req.user from auth).
 * Requires Authorization: Bearer <token> and guest user with password_hash.
 *
 * Saves the game to the backend first, then creates on-chain. This ensures guest games
 * are always in the DB; if the contract call fails we remove the placeholder game.
 */
export const createAsGuest = async (req, res) => {
  let game = null;
  try {
    const user = req.user;
    if (!user || !user.is_guest || !user.password_hash) {
      return res.status(403).json({ success: false, message: "Guest authentication required" });
    }

    const {
      code,
      mode,
      symbol,
      number_of_players,
      settings,
      is_minipay,
      is_ai,
      duration,
      chain,
      stake = 0,
      use_usdc,
    } = req.body;

    const stakeNum = Number(stake) || 0;
    if (stakeNum > 0) {
      return res.status(403).json({
        success: false,
        message: "Guests cannot create staked games. Please connect a wallet to create a staked game.",
      });
    }

    const startingCash = settings?.starting_cash ?? 1500;
    const stakeAmount = 0n; // Guests: free games only
    const gameType = mode === "PRIVATE" ? "PRIVATE" : "PUBLIC";

    // 1) Create game and related rows in DB first so guest games are always on the backend.
    //    contract_game_id is set after the on-chain create succeeds.
    game = await Game.create({
      code,
      mode,
      creator_id: user.id,
      next_player_id: user.id,
      number_of_players,
      status: "PENDING",
      is_minipay: !!is_minipay,
      is_ai: !!is_ai,
      duration,
      chain: chain || "BASE",
      contract_game_id: null,
    });

    await Chat.create({ game_id: game.id, status: "open" });

    const game_settings = await GameSetting.create({
      game_id: game.id,
      auction: settings?.auction ?? true,
      rent_in_prison: settings?.rent_in_prison ?? false,
      mortgage: settings?.mortgage ?? true,
      even_build: settings?.even_build ?? true,
      randomize_play_order: settings?.randomize_play_order ?? true,
      starting_cash: startingCash,
    });

    await GamePlayer.create({
      game_id: game.id,
      user_id: user.id,
      address: user.address,
      balance: startingCash,
      position: 0,
      turn_order: 1,
      symbol: symbol || "hat",
      chance_jail_card: false,
      community_chest_jail_card: false,
    });

    // 2) Create game on-chain (backend signs for guest).
    let onChainGameId;
    try {
      const result = await createGameByBackend(
        user.address,
        user.password_hash,
        user.username,
        gameType,
        symbol || "hat",
        number_of_players ?? 4,
        code,
        startingCash,
        stakeAmount
      );
      onChainGameId = result?.gameId;
    } catch (contractErr) {
      logger.warn({ err: contractErr?.message, gameId: game.id, code }, "createAsGuest: contract failed, removing backend game");
      await db("chats").where({ game_id: game.id }).del();
      await db("game_players").where({ game_id: game.id }).del();
      await db("game_settings").where({ game_id: game.id }).del();
      await db("games").where({ id: game.id }).del();
      return res.status(500).json({
        success: false,
        message: contractErr?.message || "Failed to create game on-chain. Try again or connect a wallet.",
      });
    }

    if (!onChainGameId) {
      await db("chats").where({ game_id: game.id }).del();
      await db("game_players").where({ game_id: game.id }).del();
      await db("game_settings").where({ game_id: game.id }).del();
      await db("games").where({ id: game.id }).del();
      return res.status(500).json({ success: false, message: "Contract did not return game ID" });
    }

    await Game.update(game.id, { contract_game_id: String(onChainGameId) });
    game = await Game.findById(game.id);

    const game_players = await GamePlayer.findByGameId(game.id);
    await recordEvent("game_created", { entityType: "game", entityId: game.id, payload: { is_ai: game.is_ai } });

    const io = req.app.get("io");
    io.to(game.code).emit("game-created", { game: { ...game, settings: game_settings, players: game_players } });

    return res.status(201).json({
      success: true,
      message: "successful",
      data: { ...game, settings: game_settings, players: game_players },
    });
  } catch (err) {
    if (game?.id) {
      try {
        await db("chats").where({ game_id: game.id }).del();
        await db("game_players").where({ game_id: game.id }).del();
        await db("game_settings").where({ game_id: game.id }).del();
        await db("games").where({ id: game.id }).del();
      } catch (cleanupErr) {
        logger.warn({ err: cleanupErr?.message, gameId: game.id }, "createAsGuest cleanup failed");
      }
    }
    logger.error({ err: err?.message }, "createAsGuest failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to create game" });
  }
};

/**
 * POST /games/join-as-guest
 * Body: { code, symbol, joinCode? }
 * Requires Authorization: Bearer <token> and guest user.
 */
export const joinAsGuest = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.is_guest || !user.password_hash) {
      return res.status(403).json({ success: false, message: "Guest authentication required" });
    }

    const { code, symbol, joinCode } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: "Game code required" });
    }

    const game = await Game.findByCode(code.trim().toUpperCase());
    if (!game) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }
    if (game.status !== "PENDING") {
      return res.status(400).json({ success: false, message: "Game not open for join" });
    }

    const currentPlayers = await GamePlayer.findByGameId(game.id);
    if (currentPlayers.length >= game.number_of_players) {
      return res.status(400).json({ success: false, message: "Game is full" });
    }
    const existingPlayer = currentPlayers.find((p) => p.user_id === user.id);
    if (existingPlayer) {
      return res.status(400).json({ success: false, message: "Already in game" });
    }

    // Look up game on-chain by code (same as waiting room / wallet flow)
    const gameCodeForContract = (code || game.code || "").trim().toUpperCase();
    if (!gameCodeForContract) {
      return res.status(400).json({ success: false, message: "Game code required" });
    }

    let contractGame;
    try {
      contractGame = await callContractRead("getGameByCode", [gameCodeForContract]);
    } catch (err) {
      const errMsg = err?.message || String(err);
      const notFound = /not found|Not found/i.test(errMsg);
      if (notFound) {
        return res.status(400).json({
          success: false,
          message: "Game not found on this network. The game was created on a different chain. Ensure the app and backend use the same network (e.g. both Celo or both Base).",
        });
      }
      throw err;
    }

    const onChainGameId = contractGame?.id ?? contractGame?.[0];
    if (onChainGameId == null || onChainGameId === "") {
      return res.status(400).json({ success: false, message: "Could not get game id from contract" });
    }

    const stakePerPlayer = BigInt(contractGame?.stakePerPlayer ?? contractGame?.[9] ?? 0);
    if (stakePerPlayer > 0n) {
      return res.status(403).json({
        success: false,
        message: "Guests cannot join staked games. Connect a wallet to join this game.",
      });
    }

    // Sync with contract: reject if game is already full on-chain (e.g. wallet user joined first)
    const onChainJoined = Number(contractGame?.joinedPlayers ?? contractGame?.[6] ?? 0);
    const onChainMax = Number(contractGame?.numberOfPlayers ?? contractGame?.[5] ?? game.number_of_players);
    if (onChainJoined >= onChainMax) {
      return res.status(400).json({ success: false, message: "Game is full" });
    }

    try {
      await joinGameByBackend(
        user.address,
        user.password_hash,
        onChainGameId,
        user.username,
        symbol || "car",
        joinCode || gameCodeForContract
      );
    } catch (err) {
      const errMsg = err?.message || String(err);
      if (/not found|Not found|Game not found/i.test(errMsg)) {
        return res.status(400).json({
          success: false,
          message: "Game not found on this network. The game was created on a different chain. Ensure the app and backend use the same network.",
        });
      }
      throw err;
    }

    const settings = await GameSetting.findByGameId(game.id);
    const maxTurnOrder = currentPlayers.length > 0 ? Math.max(...currentPlayers.map((p) => p.turn_order || 0)) : 0;
    const nextTurnOrder = maxTurnOrder + 1;

    await GamePlayer.create({
      address: user.address,
      symbol: symbol || "car",
      user_id: user.id,
      game_id: game.id,
      balance: settings?.starting_cash ?? 1500,
      position: 0,
      chance_jail_card: false,
      community_chest_jail_card: false,
      turn_order: nextTurnOrder,
      circle: 0,
      rolls: 0,
    });

    const updatedPlayers = await GamePlayer.findByGameId(game.id);
    const io = req.app.get("io");
    await invalidateGameByCode(game.code);
    emitGameUpdate(io, game.code);
    io.to(game.code).emit("player-joined", { player: updatedPlayers[updatedPlayers.length - 1], players: updatedPlayers, game });

    if (updatedPlayers.length >= game.number_of_players) {
      await Game.update(game.id, { status: "RUNNING", started_at: db.fn.now() });
      await invalidateGameById(game.id);
      const updatedGame = await Game.findByCode(game.code);
      if (updatedGame?.next_player_id) {
        await GamePlayer.setTurnStart(game.id, updatedGame.next_player_id);
      }
      const playersWithTurnStart = await GamePlayer.findByGameId(game.id);
      emitGameUpdate(io, game.code);
      io.to(game.code).emit("game-ready", { game: updatedGame, players: playersWithTurnStart });
    }

    return res.status(201).json({
      success: true,
      message: "Player added to game successfully",
      data: updatedPlayers[updatedPlayers.length - 1],
    });
  } catch (err) {
    logger.error({ err: err?.message }, "joinAsGuest failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to join game" });
  }
};

/**
 * POST /games/create-ai-as-guest
 * Body: { code, symbol, number_of_players (aiCount+1), settings, duration, chain }
 * Saves AI game to backend first, then creates on-chain (so guest AI games are always in DB).
 */
export const createAIAsGuest = async (req, res) => {
  let game = null;
  try {
    const user = req.user;
    if (!user || !user.is_guest || !user.password_hash) {
      return res.status(403).json({ success: false, message: "Guest authentication required" });
    }

    const {
      code,
      symbol,
      number_of_players,
      settings,
      duration,
      chain,
      is_minipay,
    } = req.body;

    const startingCash = settings?.starting_cash ?? 1500;
    const numberOfAI = number_of_players != null ? Math.max(1, Number(number_of_players) - 1) : 1;
    const gameCodeForContract = (code || "").trim();

    // 1) Create game and related rows in DB first.
    game = await Game.create({
      code: code || "",
      mode: "PRIVATE",
      creator_id: user.id,
      next_player_id: user.id,
      number_of_players: numberOfAI + 1,
      status: "PENDING",
      is_minipay: !!is_minipay,
      is_ai: true,
      duration: duration || 0,
      chain: chain || "BASE",
      contract_game_id: null,
    });

    await Chat.create({ game_id: game.id, status: "open" });

    await GameSetting.create({
      game_id: game.id,
      auction: settings?.auction ?? true,
      rent_in_prison: settings?.rent_in_prison ?? false,
      mortgage: settings?.mortgage ?? true,
      even_build: settings?.even_build ?? true,
      randomize_play_order: settings?.randomize_play_order ?? true,
      starting_cash: startingCash,
    });

    await GamePlayer.create({
      game_id: game.id,
      user_id: user.id,
      address: user.address,
      balance: startingCash,
      position: 0,
      turn_order: 1,
      symbol: symbol || "hat",
      chance_jail_card: false,
      community_chest_jail_card: false,
    });

    // 2) Create AI game on-chain.
    let onChainGameId;
    try {
      const { gameId: onChainGameIdFromEvent } = await createAIGameByBackend(
        user.address,
        user.password_hash,
        user.username,
        "PRIVATE",
        symbol || "hat",
        numberOfAI,
        gameCodeForContract,
        startingCash
      );
      onChainGameId = onChainGameIdFromEvent;
      if (!onChainGameId && gameCodeForContract) {
        const contractGame = await callContractRead("getGameByCode", [gameCodeForContract]);
        const id = contractGame?.id ?? contractGame?.[0];
        if (id != null) onChainGameId = String(id);
      }
    } catch (contractErr) {
      logger.warn({ err: contractErr?.message, gameId: game.id, code: gameCodeForContract }, "createAIAsGuest: contract failed, removing backend game");
      await db("chats").where({ game_id: game.id }).del();
      await db("game_players").where({ game_id: game.id }).del();
      await db("game_settings").where({ game_id: game.id }).del();
      await db("games").where({ id: game.id }).del();
      return res.status(500).json({
        success: false,
        message: contractErr?.message || "Failed to create AI game on-chain. Try again or connect a wallet.",
      });
    }

    if (!onChainGameId) {
      await db("chats").where({ game_id: game.id }).del();
      await db("game_players").where({ game_id: game.id }).del();
      await db("game_settings").where({ game_id: game.id }).del();
      await db("games").where({ id: game.id }).del();
      return res.status(500).json({ success: false, message: "Contract did not return game ID; redirect using game code." });
    }

    await Game.update(game.id, { contract_game_id: String(onChainGameId) });
    game = await Game.findById(game.id);

    const game_players = await GamePlayer.findByGameId(game.id);
    const game_settings = await GameSetting.findByGameId(game.id);
    await recordEvent("game_created", { entityType: "game", entityId: game.id, payload: { is_ai: true } });

    return res.status(201).json({
      success: true,
      message: "successful",
      data: { ...game, settings: game_settings, players: game_players },
    });
  } catch (err) {
    if (game?.id) {
      try {
        await db("chats").where({ game_id: game.id }).del();
        await db("game_players").where({ game_id: game.id }).del();
        await db("game_settings").where({ game_id: game.id }).del();
        await db("games").where({ id: game.id }).del();
      } catch (cleanupErr) {
        logger.warn({ err: cleanupErr?.message, gameId: game.id }, "createAIAsGuest cleanup failed");
      }
    }
    logger.error({ err: err?.message }, "createAIAsGuest failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to create AI game" });
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

    const io = req.app.get("io");
    await invalidateGameByCode(code);
    emitGameUpdate(io, game.code);
    io.to(game.code).emit("player-left", {
      player: player,
      players: updatedPlayers,
      game: game,
    });

    if (updatedPlayers.length === 0) {
      await Game.delete(game.id);
      io.to(game.code).emit("game-ended", { gameCode: code });
    }

    res.status(200).json({
      success: true,
      message: "Player removed from game successfully",
    });
  } catch (error) {
    logger.error({ err: error }, "Error removing game player");
    res.status(200).json({ success: false, message: error.message });
  }
};

export default gameController;
