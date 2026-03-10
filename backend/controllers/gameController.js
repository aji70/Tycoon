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
  removePlayerFromGame,
  isContractConfigured,
} from "../services/tycoonContract.js";
import {
  getGameByCodeStarknet,
  parseGameByCodeResult,
  isStarknetConfigured,
} from "../services/starknetContract.js";
import { ensureUserHasContractPassword } from "../utils/ensureContractAuth.js";
import { onGameFinished as tournamentOnGameFinished } from "../services/tournamentService.js";
import { submitErc8004Feedback as submitErc8004FeedbackTx } from "../services/erc8004Feedback.js";
import { getActiveByGameId } from "./auctionController.js";
import UserAgent from "../models/UserAgent.js";
import agentRegistry from "../services/agentRegistry.js";

// AI bot addresses (must match frontend) — used to create DB players for guest AI games so we have 2+ players from the start.
const AI_ADDRESSES = [
  "0xA1FF1c93600c3487FABBdAF21B1A360630f8bac6",
  "0xB2EE17D003e63985f3648f6c1d213BE86B474B11",
  "0xC3FF882E779aCbc112165fa1E7fFC093e9353B21",
  "0xD4FFDE5296C3EE6992bAf871418CC3BE84C99C32",
  "0xE5FF75Fcf243C4cE05B9F3dc5Aeb9F901AA361D1",
  "0xF6FF469692a259eD5920C15A78640571ee845E8",
  "0xA7FFE1f969Fa6029Ff2246e79B6A623A665cE69",
  "0xB8FF2cEaCBb67DbB5bc14D570E7BbF339cE240F6",
];
const AI_SYMBOLS = ["car", "dog", "hat", "thimble", "wheelbarrow", "battleship", "boot", "iron", "top_hat"];
/** Seconds within which all players must click "Start now" on the board for a tournament game to start. */
const GAME_READY_WINDOW_SECONDS = 30;

/** Get or create a user for an AI bot (by index). Used so game_players can reference a user_id for AI. */
async function getOrCreateAIUser(aiIndex, chain = "CELO") {
  const address = AI_ADDRESSES[aiIndex];
  if (!address) return null;
  // Address is unique in users table; find by address only so we find AI user on any chain
  const user = await User.findByAddressOnly(address);
  if (user) return user;
  const username = `AI_${aiIndex + 1}`;
  const normalizedChain = User.normalizeChain(chain);
  try {
    const created = await User.create({ address, username, chain: normalizedChain });
    return created;
  } catch (err) {
    logger.warn({ err: err?.message, address, username }, "getOrCreateAIUser create failed");
    return null;
  }
}

const AI_DIFFICULTIES = ["easy", "hard", "boss"];

/** Build ai_difficulty payload for game_settings: ai_difficulty, ai_difficulty_mode, ai_difficulty_per_slot. */
function buildAiDifficultyPayload(aiDiff, aiDiffMode, aiCount, isAi) {
  if (!isAi) return {};
  const diff = AI_DIFFICULTIES.includes(aiDiff) ? aiDiff : "boss";
  const mode = aiDiffMode === "same" ? "same" : "random";
  const payload = { ai_difficulty: diff, ai_difficulty_mode: mode };
  if (mode === "random" && aiCount > 0) {
    const perSlot = {};
    for (let s = 2; s < 2 + aiCount && s <= 8; s++) {
      perSlot[String(s)] = AI_DIFFICULTIES[Math.floor(Math.random() * AI_DIFFICULTIES.length)];
    }
    payload.ai_difficulty_per_slot = perSlot;
  }
  return payload;
}

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
 * Finish a running game by net worth (winner = highest net worth). Used by finishByTime and by vote-end-by-networth.
 * Updates DB, runs contract cleanup, invalidates cache, emits socket. Does not send HTTP response.
 * @param {object} io - Socket.io server instance (from req.app.get("io"))
 * @param {object} game - Game row (RUNNING)
 * @returns {Promise<{ winner_id, placements, winner_turn_count, valid_win } | null>}
 */
export async function finishGameByNetWorthAndNotify(io, game) {
  if (!game || game.status !== "RUNNING") return null;
  const result = await computeWinnerByNetWorth(game);
  if (!result || result.winner_id == null) return null;

  const sortedByNetWorth = [...(result.net_worths || [])].sort((a, b) => (a.net_worth ?? 0) - (b.net_worth ?? 0));
  const placements = {};
  for (let i = 0; i < sortedByNetWorth.length; i++) {
    const position = sortedByNetWorth.length - i;
    placements[sortedByNetWorth[i].user_id] = position;
  }

  const updatePayload = { status: "FINISHED", winner_id: result.winner_id, placements: JSON.stringify(placements) };
  const rowCount = await db("games")
    .where({ id: game.id, status: "RUNNING" })
    .update({ ...updatePayload, updated_at: db.fn.now() });

  if (rowCount === 0) return null;

  await agentRegistry.cleanupGame(game.id);

  tournamentOnGameFinished(game.id).catch((err) =>
    logger.warn({ err: err?.message, gameId: game.id }, "tournament onGameFinished failed")
  );

  const playerUserIds = (result.net_worths || []).map((n) => n.user_id).filter(Boolean);
  User.recordChainGameResult(game.chain || "BASE", result.winner_id, playerUserIds).catch((err) =>
    logger.warn({ err: err?.message, gameId: game.id }, "recordChainGameResult failed")
  );

  let contractGameIdToUse = game.contract_game_id;
  const chainForContract = User.normalizeChain(game.chain || "CELO");
  if (!game.is_ai && isContractConfigured(chainForContract) && game.code) {
    if (!contractGameIdToUse) {
      try {
        const contractGame = await callContractRead("getGameByCode", [(game.code || "").trim().toUpperCase()], chainForContract);
        const onChainId = contractGame?.id ?? contractGame?.[0];
        if (onChainId != null && onChainId !== "") {
          contractGameIdToUse = String(onChainId);
          await db("games").where({ id: game.id }).update({ contract_game_id: contractGameIdToUse });
        }
      } catch (err) {
        logger.warn({ err: err?.message, gameId: game.id, code: game.code }, "getGameByCode in finishGameByNetWorthAndNotify failed");
      }
    }
  }
  if (contractGameIdToUse && isContractConfigured(chainForContract)) {
    if (game.is_ai) {
      const creator = await ensureUserHasContractPassword(db, game.creator_id, chainForContract) ||
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
          isWin,
          chainForContract
        ).catch((err) => logger.warn({ err: err?.message, gameId: game.id }, "endAIGameByBackend failed"));
      }
    } else {
      const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
      const playerRows = await db("game_players").where({ game_id: game.id }).select("user_id", "turn_count");
      const turnCountByUser = Object.fromEntries(playerRows.map((r) => [r.user_id, Number(r.turn_count ?? 0)]));
      for (const { user_id } of sortedByNetWorth) {
        const user = await db("users").where({ id: user_id }).select("address").first();
        if (!user?.address) continue;
        const turnCount = turnCountByUser[user_id];
        try {
          await removePlayerFromGame(
            contractGameIdToUse,
            user.address,
            turnCount != null && turnCount >= 20 ? turnCount : MAX_UINT256,
            chainForContract
          );
        } catch (err) {
          logger.warn({ err: err?.message, gameId: game.id, user_id }, "finishGameByNetWorthAndNotify: removePlayerFromGame failed");
        }
      }
    }
  }
  await invalidateGameById(game.id);
  if (io) emitGameUpdate(io, game.code);
  return {
    winner_id: result.winner_id,
    placements,
    winner_turn_count: result.winner_turn_count || 0,
    valid_win: result.valid_win !== false,
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
      const normalizedChain = User.normalizeChain(chain);
      const user = await User.resolveUserByAddress(address, normalizedChain);
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

      const aiDiff = req.body.ai_difficulty || settings?.ai_difficulty || "boss";
      const aiDiffMode = req.body.ai_difficulty_mode || settings?.ai_difficulty_mode || "random";
      const aiCount = game.is_ai ? Math.max(0, (number_of_players || 2) - 1) : 0;
      const gameSettingsPayload = {
        game_id: game.id,
        auction: settings.auction,
        rent_in_prison: settings.rent_in_prison,
        mortgage: settings.mortgage,
        even_build: settings.even_build,
        randomize_play_order: settings?.randomize_play_order ?? true,
        starting_cash: settings.starting_cash,
        ...buildAiDifficultyPayload(aiDiff, aiDiffMode, aiCount, game.is_ai),
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
      const payload = { ...req.body };
      // When setting game to RUNNING, set started_at so duration countdown starts from now (fixes AI "time's up" immediately).
      if (payload.status === "RUNNING") {
        const existing = await Game.findById(req.params.id);
        if (existing && !existing.started_at) payload.started_at = db.fn.now();
      }
      await Game.update(req.params.id, payload);
      if (payload.status === "RUNNING") {
        await recordEvent("game_started", { entityType: "game", entityId: Number(req.params.id), payload: {} });
      }
      if (payload.status === "FINISHED") {
        await recordEvent("game_finished", { entityType: "game", entityId: Number(req.params.id), payload: { winner_id: payload.winner_id ?? null } });
        await agentRegistry.cleanupGame(req.params.id);
      }
      await invalidateGameById(req.params.id);
      const io = req.app.get("io");
      const game = await Game.findById(req.params.id);
      if (game?.code) emitGameUpdate(io, game.code);

      // Multiplayer game set to FINISHED: if requester is a guest (has password_hash), backend exits on-chain on their behalf
      if (
        payload.status === "FINISHED" &&
        game &&
        game.is_ai !== true &&
        game.contract_game_id &&
        req.user?.id
      ) {
        const chainForContract = User.normalizeChain(game.chain || "CELO");
        if (isContractConfigured(chainForContract)) {
          const user = await db("users").where({ id: req.user.id }).select("address", "username", "password_hash").first();
          if (user?.address && user?.password_hash) {
            exitGameByBackend(
              user.address,
              user.username || "",
              user.password_hash,
              game.contract_game_id,
              chainForContract
            ).catch((err) =>
              logger.warn({ err: err?.message, gameId: game.id, userId: req.user.id }, "exitGameByBackend for guest on FINISHED update failed")
            );
          }
        }
      }

      // AI game set to FINISHED (e.g. human declared bankruptcy): backend ends on-chain so user never needs to sign
      if (payload.status === "FINISHED" && game?.is_ai && game.contract_game_id) {
        const chainForContract = User.normalizeChain(game.chain || "CELO");
        if (isContractConfigured(chainForContract)) {
          const creator = await ensureUserHasContractPassword(db, game.creator_id, chainForContract) ||
            (await db("users").where({ id: game.creator_id }).select("address", "username", "password_hash").first());
          const humanGp = await db("game_players").where({ game_id: game.id, user_id: game.creator_id }).select("position", "balance").first();
          if (creator?.address && creator?.password_hash && humanGp) {
            const isWin = game.winner_id === game.creator_id;
            endAIGameByBackend(
              creator.address,
              creator.username || "",
              creator.password_hash,
              game.contract_game_id,
              Number(humanGp.position ?? 0),
              String(humanGp.balance ?? 0),
              isWin,
              chainForContract
            ).catch((err) =>
              logger.warn({ err: err?.message, gameId: game.id }, "endAIGameByBackend on game update (e.g. bankruptcy) failed")
            );
          }
        }
      }

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
   * POST: Record that the current user clicked "Start now" for a tournament game.
   * Game must be PENDING with ready_window_opens_at set. When all players have requested within 30s, game becomes RUNNING.
   */
  async requestStart(req, res) {
    try {
      const gameId = Number(req.params.id);
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });

      const game = await Game.findById(gameId);
      if (!game) return res.status(404).json({ success: false, message: "Game not found" });
      if (game.status !== "PENDING") {
        return res.status(400).json({ success: false, message: "Game is not waiting for start" });
      }
      const opensAt = game.ready_window_opens_at ? new Date(game.ready_window_opens_at) : null;
      if (!opensAt) return res.status(400).json({ success: false, message: "Start window not open" });

      const windowEnd = new Date(opensAt.getTime() + GAME_READY_WINDOW_SECONDS * 1000);
      const now = new Date();
      if (now < opensAt) return res.status(400).json({ success: false, message: "Start window has not opened yet" });
      if (now > windowEnd) return res.status(400).json({ success: false, message: "Start window has closed" });

      const players = await GamePlayer.findByGameId(game.id);
      const isInGame = players.some((p) => p.user_id === userId);
      if (!isInGame) return res.status(403).json({ success: false, message: "You are not in this game" });

      const existing = await db("game_start_requests").where({ game_id: game.id, user_id: userId }).first();
      if (existing) {
        await db("game_start_requests").where({ game_id: game.id, user_id: userId }).update({
          requested_at: now,
          updated_at: db.fn.now(),
        });
      } else {
        await db("game_start_requests").insert({
          game_id: game.id,
          user_id: userId,
          requested_at: now,
        });
      }

      const requests = await db("game_start_requests").where({ game_id: game.id });
      const inWindow = requests.filter((r) => {
        const t = new Date(r.requested_at);
        return t >= opensAt && t <= windowEnd;
      });
      const uniqueUserIds = [...new Set(inWindow.map((r) => r.user_id))];

      if (uniqueUserIds.length >= game.number_of_players) {
        await Game.update(game.id, { status: "RUNNING", started_at: db.fn.now() });
        await recordEvent("game_started", { entityType: "game", entityId: game.id, payload: {} });
        await invalidateGameById(game.id);
        const updatedGame = await Game.findById(game.id);
        if (updatedGame?.next_player_id) {
          await GamePlayer.setTurnStart(game.id, updatedGame.next_player_id);
        }
        const io = req.app.get("io");
        if (io && game.code) {
          emitGameUpdate(io, game.code);
          io.to(game.code).emit("game-started", { game: updatedGame });
        }
        return res.status(200).json({
          success: true,
          started: true,
          message: "Game started",
          data: { game: updatedGame },
        });
      }

      return res.status(200).json({
        success: true,
        started: false,
        message: `Waiting for ${game.number_of_players - uniqueUserIds.length} more player(s) to click Start now`,
      });
    } catch (error) {
      logger.error({ err: error }, "requestStart error");
      return res.status(500).json({ success: false, message: error?.message || "Failed to request start" });
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
        return res.status(200).json({
          success: true,
          message: "Game already concluded",
          data: { game, winner_id: game.winner_id, valid_win: true },
        });
      }
      if (game.status !== "RUNNING") return res.status(400).json({ success: false, error: "Game is not running" });

      const durationMinutes = Number(game.duration) || 0;
      if (durationMinutes <= 0) return res.status(400).json({ success: false, error: "Game has no duration" });

      const startAt = game.started_at || game.created_at;
      const endMs = new Date(startAt).getTime() + durationMinutes * 60 * 1000;
      // Allow up to 30s before end: handles client/server clock skew; countdown fires at 0.
      if (Date.now() < endMs - 30000) return res.status(400).json({ success: false, error: "Game time has not ended yet" });

      const result = await computeWinnerByNetWorth(game);
      if (!result || result.winner_id == null) return res.status(400).json({ success: false, error: "Could not compute winner" });

      const sortedByNetWorth = [...(result.net_worths || [])].sort((a, b) => (a.net_worth ?? 0) - (b.net_worth ?? 0));
      let placements = {};
      for (let i = 0; i < sortedByNetWorth.length; i++) {
        const position = sortedByNetWorth.length - i;
        placements[sortedByNetWorth[i].user_id] = position;
      }

      const updatePayload = { status: "FINISHED", winner_id: result.winner_id };
      if (placements) updatePayload.placements = JSON.stringify(placements);

      // Atomic claim: only one request wins the transition RUNNING → FINISHED. Others get 0 rows and return existing game.
      const rowCount = await db("games")
        .where({ id: game.id, status: "RUNNING" })
        .update({ ...updatePayload, updated_at: db.fn.now() });

      if (rowCount === 0) {
        const updated = await Game.findById(game.id);
        return res.status(200).json({
          success: true,
          message: "Game already concluded",
          data: { game: updated, winner_id: updated?.winner_id, valid_win: true },
        });
      }

      await agentRegistry.cleanupGame(game.id);
      await recordEvent("game_finished", { entityType: "game", entityId: game.id, payload: { winner_id: result.winner_id } });
      tournamentOnGameFinished(game.id).catch((err) =>
        logger.warn({ err: err?.message, gameId: game.id }, "tournament onGameFinished failed")
      );

      const playerUserIds = (result.net_worths || []).map((n) => n.user_id).filter(Boolean);
      User.recordChainGameResult(game.chain || "BASE", result.winner_id, playerUserIds).catch((err) =>
        logger.warn({ err: err?.message, gameId: game.id }, "recordChainGameResult failed")
      );

      // We won the race — run contract removals. Catch errors so "Not in game" (another request removed them) doesn't fail us.
  let contractGameIdToUse = game.contract_game_id;
  const chainForContract = User.normalizeChain(game.chain || "CELO");
  if (!game.is_ai && isContractConfigured(chainForContract) && game.code) {
        if (!contractGameIdToUse) {
          try {
            const contractGame = await callContractRead("getGameByCode", [(game.code || "").trim().toUpperCase()], chainForContract);
            const onChainId = contractGame?.id ?? contractGame?.[0];
            if (onChainId != null && onChainId !== "") {
              contractGameIdToUse = String(onChainId);
              await db("games").where({ id: game.id }).update({ contract_game_id: contractGameIdToUse });
            }
          } catch (err) {
            logger.warn({ err: err?.message, gameId: game.id, code: game.code }, "getGameByCode in finishByTime failed");
          }
        }
      }
      if (contractGameIdToUse && isContractConfigured(chainForContract)) {
        if (game.is_ai) {
          const creator = await ensureUserHasContractPassword(db, game.creator_id, chainForContract) ||
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
              isWin,
              chainForContract
            ).catch((err) => logger.warn({ err: err?.message, gameId: game.id }, "endAIGameByBackend failed (game already ended on-chain?)"));
          }
        } else {
          // Multiplayer: remove players from contract in order (lowest net worth first).
          // When we remove the second-to-last player (last loser), the contract in that same tx:
          // - pays that player their rank payout, then sees joinedPlayers == 1,
          // - ends the game and pays the remaining player (the winner) via _payoutReward(winner, rank 1).
          // So the winner (guest or wallet user) already receives USDC/rewards in that backend-driven tx;
          // no wallet signing is needed — "Finalize & go home" only syncs DB.
          // Guests have a custodial address (created at sign-up); when a guest wins, the contract pays that address.
          const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
          const playerRows = await db("game_players").where({ game_id: game.id }).select("user_id", "turn_count");
          const turnCountByUser = Object.fromEntries(playerRows.map((r) => [r.user_id, Number(r.turn_count ?? 0)]));
          for (const { user_id } of sortedByNetWorth) {
            const user = await db("users").where({ id: user_id }).select("address").first();
            if (!user?.address) {
              logger.warn({ gameId: game.id, user_id }, "finishByTime: skip contract remove — user has no address");
              continue;
            }
            const turnCount = turnCountByUser[user_id];
            try {
              await removePlayerFromGame(
                contractGameIdToUse,
                user.address,
                turnCount != null && turnCount >= 20 ? turnCount : MAX_UINT256,
                chainForContract
              );
            } catch (err) {
              logger.warn(
                { err: err?.message, gameId: game.id, user_id },
                "finishByTime: removePlayerFromGame failed (Not in game / race) — continuing"
              );
            }
          }
        }
      }
      await invalidateGameById(game.id);
      const io = req.app.get("io");
      if (io) emitGameUpdate(io, game.code);

      const updated = await Game.findById(game.id);
      let parsedPlacements = placements;
      if (typeof parsedPlacements === "string") parsedPlacements = JSON.parse(parsedPlacements);
      if (!parsedPlacements && updated?.placements) {
        parsedPlacements = typeof updated.placements === "string" ? JSON.parse(updated.placements) : updated.placements;
      }
      return res.status(200).json({
        success: true,
        message: "Game finished by time; winner by net worth",
        data: {
          game: updated,
          winner_id: result.winner_id,
          winner_turn_count: result.winner_turn_count || 0,
          valid_win: result.valid_win !== false,
          placements: parsedPlacements,
        },
      });
    } catch (error) {
      logger.error({ err: error }, "finishByTime error");
      return res.status(500).json({ success: false, message: error?.message || "Failed to finish game by time" });
    }
  },

  /**
   * POST: Submit ERC-8004 reputation feedback for an AI game (backend signs; user does not).
   * Call after claim. Idempotent: safe to call multiple times.
   */
  async submitErc8004Feedback(req, res) {
    try {
      const game = await Game.findById(req.params.id);
      if (!game) return res.status(404).json({ success: false, error: "Game not found" });
      if (game.status !== "FINISHED" || !game.is_ai) {
        return res.status(200).json({ success: true, skipped: true, message: "Not an AI game or not finished" });
      }
      const agentId = process.env.ERC8004_AGENT_ID;
      if (!agentId || String(agentId).trim() === "") {
        return res.status(200).json({ success: true, skipped: true, message: "ERC8004_AGENT_ID not set" });
      }
      const humanUserId = game.creator_id;
      const score = game.winner_id === humanUserId ? 0 : 100;
      const result = await submitErc8004FeedbackTx(agentId, score);
      if (result.success) {
        return res.status(200).json({ success: true, hash: result.hash });
      }
      return res.status(200).json({ success: true, skipped: true, error: result.error });
    } catch (error) {
      logger.warn({ err: error, gameId: req.params.id }, "submitErc8004Feedback error");
      return res.status(200).json({ success: true, skipped: true, message: error?.message || "Feedback failed" });
    }
  },

  // -------------------------
  // 🔹 Extra Endpoints
  // -------------------------

  async findByCode(req, res) {
    try {
      const rawCode = req.params.code;
      const code = rawCode != null ? String(rawCode).trim().toUpperCase() : "";
      if (!code) return res.status(404).json({ error: "Game not found" });
      const cached = await getCachedGameByCode(code);
      if (cached) {
        return res.json({
          success: true,
          message: "successful",
          data: cached,
        });
      }

      let game = await Game.findByCode(code);
      if (!game && isStarknetConfigured()) {
        try {
          const raw = await getGameByCodeStarknet(code);
          const parsed = parseGameByCodeResult(raw);
          if (parsed?.gameId && parsed?.creatorAddress) {
            let creatorUser = await User.resolveUserByAddress(parsed.creatorAddress, "STARKNET");
            if (!creatorUser) {
              const addr = String(parsed.creatorAddress).trim().toLowerCase();
              creatorUser = await User.create({
                address: addr,
                username: addr.slice(0, 16),
                chain: "STARKNET",
              });
              logger.info({ address: addr }, "Created minimal user for sync-from-chain game creator");
            }
            game = await Game.create({
              code,
              mode: "PRIVATE",
              creator_id: creatorUser.id,
              next_player_id: creatorUser.id,
              number_of_players: 4,
              status: "PENDING",
              is_minipay: false,
              is_ai: false,
              duration: 30,
              chain: "STARKNET",
              contract_game_id: parsed.gameId,
            });
            await Chat.create({ game_id: game.id, status: "open" });
            await GameSetting.create({
              game_id: game.id,
              auction: true,
              rent_in_prison: false,
              mortgage: true,
              even_build: true,
              randomize_play_order: true,
              starting_cash: 1500,
            });
            await GamePlayer.create({
              game_id: game.id,
              user_id: creatorUser.id,
              address: creatorUser.address,
              balance: 1500,
              position: 0,
              turn_order: 1,
              symbol: "hat",
              chance_jail_card: false,
              community_chest_jail_card: false,
            });
            logger.info({ code, gameId: parsed.gameId }, "Synced game from Starknet to backend");
          }
        } catch (err) {
          if (err?.message?.includes("not found") || err?.message?.includes("Not found")) {
            return res.status(404).json({ error: "Game not found" });
          }
          logger.warn({ err: err?.message, code }, "Sync from Starknet failed, returning 404");
        }
      }
      if (!game) return res.status(404).json({ error: "Game not found" });
      // Return full game data for FINISHED/CANCELLED so the board can show winner modal; no "Game ended" error that would replace the page.
      const settings = await GameSetting.findByGameId(game.id);
      const players = await GamePlayer.findByGameId(game.id);
      const history = await GamePlayHistory.findByGameId(game.id);
      const active_auction = await getActiveByGameId(game.id);
      const data = { ...game, settings, players, history, active_auction: active_auction || undefined };
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

      const gameIds = games.map((g) => g.id);
      const [settingsList, playersList] = await Promise.all([
        GameSetting.findByGameIds(gameIds),
        GamePlayer.findByGameIds(gameIds),
      ]);
      const settingsByGame = {};
      for (const s of settingsList) {
        const { game_id, ...rest } = s;
        settingsByGame[game_id] = rest;
      }
      const playersByGame = {};
      for (const p of playersList) {
        const { game_id, ...rest } = p;
        if (!playersByGame[game_id]) playersByGame[game_id] = [];
        playersByGame[game_id].push(rest);
      }

      const withSettingsAndPlayers = games.map((g) => ({
        ...g,
        settings: settingsByGame[g.id] ?? null,
        players: playersByGame[g.id] ?? [],
      }));

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

      const gameIds = games.map((g) => g.id);
      const [settingsList, playersList] = await Promise.all([
        GameSetting.findByGameIds(gameIds),
        GamePlayer.findByGameIds(gameIds),
      ]);
      const settingsByGame = {};
      for (const s of settingsList) {
        const { game_id, ...rest } = s;
        settingsByGame[game_id] = rest;
      }
      const playersByGame = {};
      for (const p of playersList) {
        const { game_id, ...rest } = p;
        if (!playersByGame[game_id]) playersByGame[game_id] = [];
        playersByGame[game_id].push(rest);
      }

      const withSettingsAndPlayers = games.map((g) => ({
        ...g,
        settings: settingsByGame[g.id] ?? null,
        players: playersByGame[g.id] ?? [],
      }));

      res.json({
        success: true,
        message: "successful",
        data: withSettingsAndPlayers,
      });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },

  /** GET /games/open — PENDING + PUBLIC only (browse lobbies). */
  async findOpen(req, res) {
    try {
      const { limit, offset } = req.query;
      const games = await Game.findOpenGames({
        limit: Math.min(Number.parseInt(limit) || 50, 100),
        offset: Number.parseInt(offset) || 0,
      });
      const withSettingsAndPlayers = await Promise.all(
        games.map(async (g) => ({
          ...g,
          settings: await GameSetting.findByGameId(g.id),
          players: await GamePlayer.findByGameId(g.id),
        }))
      );
      res.json({ success: true, message: "successful", data: withSettingsAndPlayers });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },

  /**
   * Games where the current user is a player (for "Continue Game").
   * Auth: optionalAuth — if req.user set (guest or registered with token), use user_id; else if query address=0x..., use address.
   */
  async findMyGames(req, res) {
    try {
      const { limit, offset, address: queryAddress } = req.query;
      const opts = {
        limit: Math.min(Number.parseInt(limit) || 50, 100),
        offset: Number.parseInt(offset) || 0,
      };
      let games = [];
      if (req.user?.id) {
        games = await Game.findByPlayer({ userId: req.user.id }, opts);
      } else if (queryAddress && String(queryAddress).trim()) {
        games = await Game.findByPlayer({ address: String(queryAddress).trim() }, opts);
      }
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
      res.status(500).json({ success: false, message: error.message });
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
    const normalizedChain = User.normalizeChain(chain);
    const user = await User.resolveUserByAddress(address, normalizedChain);
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

    const aiDiff = req.body.ai_difficulty || settings?.ai_difficulty || "boss";
    const aiDiffMode = req.body.ai_difficulty_mode || settings?.ai_difficulty_mode || "random";
    const aiCount = is_ai ? Math.max(0, (number_of_players || 2) - 1) : 0;
    const gameSettingsPayload = {
      game_id: game.id,
      auction: settings.auction,
      rent_in_prison: settings.rent_in_prison,
      mortgage: settings.mortgage,
      even_build: settings.even_build,
      randomize_play_order: settings?.randomize_play_order ?? true,
      starting_cash: settings.starting_cash,
      ...buildAiDifficultyPayload(aiDiff, aiDiffMode, aiCount, is_ai),
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
    const { address, code, symbol, chain } = req.body;

    // find user (by primary address or linked wallet)
    const user = await User.resolveUserByAddress(address, chain || "BASE");
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
    await recordEvent("game_joined", { entityType: "game", entityId: game.id, payload: { user_id: user.id } });

    if (updatedPlayers.length === game.number_of_players) {
      await Game.update(game.id, { status: "RUNNING", started_at: db.fn.now() });
      await recordEvent("game_started", { entityType: "game", entityId: game.id, payload: {} });
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
 */
export const createAsGuest = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.is_guest) {
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
    const chainForCreate = User.normalizeChain(chain || "CELO");

    // Privy (and other guest-without-password) users: ensure on-chain registration so we can call contract
    const contractUser = user.password_hash
      ? user
      : await ensureUserHasContractPassword(db, user.id, chainForCreate);
    if (!contractUser?.password_hash) {
      return res.status(403).json({
        success: false,
        message: "Guest authentication required. Link a wallet or use a guest account that can create games.",
      });
    }
    const isAI = !!is_ai;
    const numberOfAI = isAI ? Math.max(1, (number_of_players ?? 2) - 1) : 0;

    // AI games must be created with createAIGameByBackend so on-chain game.ai is true (required for endAIGame).
    // Use create-ai-as-guest for guest AI games; this branch only handles accidental is_ai on create-as-guest.
    let onChainGameId;
    if (isAI) {
      const result = await createAIGameByBackend(
        contractUser.address,
        contractUser.password_hash,
        contractUser.username,
        gameType,
        symbol || "hat",
        numberOfAI,
        code,
        startingCash,
        chainForCreate
      );
      onChainGameId = result?.gameId;
    } else {
      const result = await createGameByBackend(
        contractUser.address,
        contractUser.password_hash,
        contractUser.username,
        gameType,
        symbol || "hat",
        number_of_players ?? 4,
        code,
        startingCash,
        stakeAmount,
        chainForCreate
      );
      onChainGameId = result?.gameId;
    }

    if (!onChainGameId) {
      return res.status(500).json({ success: false, message: "Contract did not return game ID" });
    }

    const game = await Game.create({
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
      contract_game_id: String(onChainGameId),
    });

    const chat = await Chat.create({ game_id: game.id, status: "open" });

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
    if (!user || !user.is_guest) {
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

    const chainForJoin = User.normalizeChain(game.chain || "CELO");
    // Privy (and other guest-without-password) users: ensure on-chain registration so we can join
    const contractUser = user.password_hash
      ? user
      : await ensureUserHasContractPassword(db, user.id, chainForJoin);
    if (!contractUser?.password_hash) {
      return res.status(403).json({
        success: false,
        message: "Guest authentication required. Link a wallet or use a guest account that can join games.",
      });
    }

    // Tournament lobby: game not created on-chain yet — avoid RPC call and return clear message
    if (!game.contract_game_id) {
      return res.status(400).json({
        success: false,
        message: "Tournament match not ready yet. The first player must create the game with their wallet; then you can join as guest.",
      });
    }

    // Look up game on-chain by code (same as waiting room / wallet flow)
    const gameCodeForContract = (code || game.code || "").trim().toUpperCase();
    if (!gameCodeForContract) {
      return res.status(400).json({ success: false, message: "Game code required" });
    }

    let contractGame;
    try {
      contractGame = await callContractRead("getGameByCode", [gameCodeForContract], chainForJoin);
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
        contractUser.address,
        contractUser.password_hash,
        onChainGameId,
        contractUser.username,
        symbol || "car",
        joinCode || gameCodeForContract,
        chainForJoin
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

    try {
      await GamePlayer.join({
        address: contractUser.address,
        symbol: (symbol || "car").toString().trim().toLowerCase(),
        user_id: user.id,
        game_id: game.id,
        balance: settings?.starting_cash ?? 1500,
        position: 0,
        chance_jail_card: false,
        community_chest_jail_card: false,
        circle: 0,
        rolls: 0,
      });
    } catch (err) {
      const msg = err?.message || String(err);
      if (/already taken|symbol.*taken/i.test(msg)) {
        return res.status(400).json({
          success: false,
          message: `Symbol "${symbol || "car"}" is already taken in this game. Please choose another token.`,
        });
      }
      throw err;
    }

    const updatedPlayers = await GamePlayer.findByGameId(game.id);
    const io = req.app.get("io");
    await invalidateGameByCode(game.code);
    emitGameUpdate(io, game.code);
    io.to(game.code).emit("player-joined", { player: updatedPlayers[updatedPlayers.length - 1], players: updatedPlayers, game });
    await recordEvent("game_joined", { entityType: "game", entityId: game.id, payload: { user_id: user.id } });

    if (updatedPlayers.length >= game.number_of_players) {
      await Game.update(game.id, { status: "RUNNING", started_at: db.fn.now() });
      await recordEvent("game_started", { entityType: "game", entityId: game.id, payload: {} });
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
    recordEvent("error", { payload: { code: "join_as_guest", message: (err?.message || String(err)).slice(0, 200) } }).catch(() => {});
    return res.status(500).json({ success: false, message: err?.message || "Failed to join game" });
  }
};

/**
 * POST /games/create-ai-as-guest
 * Body: { code, symbol, number_of_players (aiCount+1), settings, duration, chain }
 * Creates AI game on-chain via createAIGameByBackend then DB game with is_ai: true.
 */
export const createAIAsGuest = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.is_guest) {
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
    const aiDifficulty = settings?.ai_difficulty || req.body.ai_difficulty || "boss";
    const aiDiffMode = settings?.ai_difficulty_mode || req.body.ai_difficulty_mode || "random";

    const startingCash = settings?.starting_cash ?? 1500;
    const numberOfAI = number_of_players != null ? Math.max(1, Number(number_of_players) - 1) : 1;
    const chainForAICreate = User.normalizeChain(chain || "CELO");

    // Privy (and other guest-without-password) users: ensure on-chain registration so we can call contract
    const contractUser = user.password_hash
      ? user
      : await ensureUserHasContractPassword(db, user.id, chainForAICreate);
    if (!contractUser?.password_hash) {
      return res.status(403).json({
        success: false,
        message: "Guest authentication required. Link a wallet or use a guest account that can create games.",
      });
    }

    const gameCodeForContract = (code || "").trim();
    const { gameId: onChainGameIdFromEvent } = await createAIGameByBackend(
      contractUser.address,
      contractUser.password_hash,
      contractUser.username,
      "PRIVATE",
      symbol || "hat",
      numberOfAI,
      gameCodeForContract,
      startingCash,
      chainForAICreate
    );

    let onChainGameId = onChainGameIdFromEvent;
    if (!onChainGameId && gameCodeForContract) {
      try {
        const contractGame = await callContractRead("getGameByCode", [gameCodeForContract], chainForAICreate);
        const id = contractGame?.id ?? contractGame?.[0];
        if (id != null) onChainGameId = String(id);
      } catch (lookupErr) {
        logger.warn({ err: lookupErr?.message, code: gameCodeForContract }, "getGameByCode fallback failed after createAIGameByBackend");
      }
    }

    if (!onChainGameId) {
      return res.status(500).json({ success: false, message: "Contract did not return game ID; redirect using game code." });
    }

    const game = await Game.create({
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
      contract_game_id: String(onChainGameId),
    });

    const chat = await Chat.create({ game_id: game.id, status: "open" });

    const aiDiffPayload = buildAiDifficultyPayload(aiDifficulty, aiDiffMode, numberOfAI, true);
    await GameSetting.create({
      game_id: game.id,
      auction: settings?.auction ?? true,
      rent_in_prison: settings?.rent_in_prison ?? false,
      mortgage: settings?.mortgage ?? true,
      even_build: settings?.even_build ?? true,
      randomize_play_order: settings?.randomize_play_order ?? true,
      starting_cash: startingCash,
      ...aiDiffPayload,
    });

    await GamePlayer.create({
      game_id: game.id,
      user_id: user.id,
      address: contractUser.address,
      balance: startingCash,
      position: 0,
      turn_order: 1,
      symbol: symbol || "hat",
      chance_jail_card: false,
      community_chest_jail_card: false,
    });

    // Add AI players in DB so we have 2+ players from the start (frontend AI "join" would fail for guest).
    const humanSymbol = (symbol || "hat").toLowerCase();
    const availableSymbols = AI_SYMBOLS.filter((s) => s !== humanSymbol);
    for (let i = 0; i < numberOfAI; i++) {
      const aiUser = await getOrCreateAIUser(i, chainForAICreate);
      if (!aiUser) continue;
      const aiSymbol = availableSymbols[i % availableSymbols.length] || AI_SYMBOLS[i % AI_SYMBOLS.length];
      await GamePlayer.create({
        game_id: game.id,
        user_id: aiUser.id,
        address: aiUser.address,
        balance: startingCash,
        position: 0,
        turn_order: i + 2,
        symbol: aiSymbol,
        chance_jail_card: false,
        community_chest_jail_card: false,
      });
    }

    const game_players = await GamePlayer.findByGameId(game.id);
    const game_settings = await GameSetting.findByGameId(game.id);
    await recordEvent("game_created", { entityType: "game", entityId: game.id, payload: { is_ai: true } });

    return res.status(201).json({
      success: true,
      message: "successful",
      data: { ...game, settings: game_settings, players: game_players },
    });
  } catch (err) {
    logger.error({ err: err?.message }, "createAIAsGuest failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to create AI game" });
  }
};

/**
 * POST /games/:id/add-ai-players
 * Body: { ai_count: number }
 * Adds AI players directly to an existing game (for wallet-created AI games).
 */
export const addAIPlayers = async (req, res) => {
  try {
    const { id } = req.params;
    const { ai_count } = req.body;

    if (!ai_count || ai_count < 1) {
      return res.status(400).json({ success: false, message: "ai_count must be at least 1" });
    }

    const game = await Game.findById(id);
    if (!game) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    if (!game.is_ai) {
      return res.status(400).json({ success: false, message: "This endpoint is only for AI games" });
    }

    if (game.status !== "PENDING") {
      return res.status(400).json({ success: false, message: "Can only add AI players to pending games" });
    }

    const existingPlayers = await GamePlayer.findByGameId(game.id);
    const humanSymbol = existingPlayers.find(p => {
      const aiAddresses = AI_ADDRESSES.map(a => a.toLowerCase());
      return !aiAddresses.includes(String(p.address || "").toLowerCase());
    })?.symbol?.toLowerCase() || "hat";

    const availableSymbols = AI_SYMBOLS.filter((s) => s !== humanSymbol);
    const settings = await GameSetting.findByGameId(game.id);
    const startingCash = settings?.starting_cash ?? 1500;

    const chainForAI = User.normalizeChain(game.chain || "CELO");
    const addedPlayers = [];
    for (let i = 0; i < ai_count; i++) {
      const aiUser = await getOrCreateAIUser(i, chainForAI);
      if (!aiUser) {
        logger.warn({ aiIndex: i }, "Failed to get or create AI user");
        continue;
      }

      // Check if this AI is already in the game
      const alreadyInGame = existingPlayers.some(p => p.user_id === aiUser.id);
      if (alreadyInGame) {
        logger.info({ aiIndex: i, address: aiUser.address }, "AI player already in game");
        continue;
      }

      const aiSymbol = availableSymbols[i % availableSymbols.length] || AI_SYMBOLS[i % AI_SYMBOLS.length];
      const turnOrder = existingPlayers.length + addedPlayers.length + 1;

      const aiPlayer = await GamePlayer.create({
        game_id: game.id,
        user_id: aiUser.id,
        address: aiUser.address,
        balance: startingCash,
        position: 0,
        turn_order: turnOrder,
        symbol: aiSymbol,
        chance_jail_card: false,
        community_chest_jail_card: false,
      });

      addedPlayers.push(aiPlayer);
    }

    const updatedPlayers = await GamePlayer.findByGameId(game.id);
    const io = req.app.get("io");
    await invalidateGameByCode(game.code);
    if (io) {
      emitGameUpdate(io, game.code);
      io.to(game.code).emit("ai-players-added", { players: updatedPlayers, game });
    }

    return res.status(200).json({
      success: true,
      message: `Added ${addedPlayers.length} AI player(s)`,
      data: { players: updatedPlayers, added: addedPlayers.length },
    });
  } catch (err) {
    logger.error({ err: err?.message }, "addAIPlayers failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to add AI players" });
  }
};

/** Slot used for "my agent plays for me" (user's seat) in the agent registry. */
const USER_AGENT_SLOT = 1;

/**
 * POST /games/:id/use-my-agent
 * Body: { user_agent_id: number }
 * Registers the authenticated user's agent for their seat in this game (slot 1). Requires auth; user must be in the game.
 */
export const useMyAgent = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const gameId = Number(req.params.id);
    const { user_agent_id } = req.body || {};
    if (!user_agent_id) {
      return res.status(400).json({ success: false, message: "user_agent_id is required" });
    }

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    const player = await GamePlayer.findByUserIdAndGameId(userId, gameId);
    if (!player) {
      return res.status(403).json({ success: false, message: "You are not in this game" });
    }

    const agent = await UserAgent.findByIdAndUser(Number(user_agent_id), userId);
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    const callbackUrl = UserAgent.getCallbackUrl(agent);
    const hasSavedKey = UserAgent.hasSavedApiKey(agent);
    const usesTycoonKey = UserAgent.usesTycoonKey(agent);
    if (!callbackUrl && !hasSavedKey && !usesTycoonKey) {
      return res.status(400).json({
        success: false,
        message: "Agent needs a callback URL, saved API key, or Tycoon hosting (set in My Agents)",
      });
    }

    await agentRegistry.registerAgent({
      gameId,
      slot: USER_AGENT_SLOT,
      agentId: String(agent.erc8004_agent_id || agent.id),
      callbackUrl: callbackUrl || undefined,
      user_agent_id: hasSavedKey || usesTycoonKey ? agent.id : undefined,
      chainId: agent.chain_id ?? 42220,
      name: agent.name || "My Agent",
    });

    return res.status(200).json({
      success: true,
      message: "Your agent is now playing for you in this game",
      data: { gameId, slot: USER_AGENT_SLOT, agentName: agent.name },
    });
  } catch (err) {
    logger.error({ err: err?.message }, "useMyAgent failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to use your agent" });
  }
};

/**
 * POST /games/:id/stop-using-my-agent
 * Unregisters the user's agent for this game (slot 1). Requires auth.
 */
export const stopUsingMyAgent = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const gameId = Number(req.params.id);

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    const player = await GamePlayer.findByUserIdAndGameId(userId, gameId);
    if (!player) {
      return res.status(403).json({ success: false, message: "You are not in this game" });
    }

    await agentRegistry.unregisterAgent(USER_AGENT_SLOT, gameId);

    return res.status(200).json({
      success: true,
      message: "Your agent is no longer playing for you in this game",
      data: { gameId },
    });
  } catch (err) {
    logger.error({ err: err?.message }, "stopUsingMyAgent failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to stop using your agent" });
  }
};

/**
 * GET /games/:id/agent-bindings
 * Returns which agents are registered for this game (including slot 1 = "my agent plays for me").
 * Optional auth: if authenticated, includes myAgentOn (true if slot 1 is registered for this game).
 */
export const getAgentBindings = async (req, res) => {
  try {
    const gameId = Number(req.params.id);
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    const bindings = agentRegistry.getAgentsForGame(gameId);
    const myAgentOn = bindings.some((b) => b.slot === USER_AGENT_SLOT);

    return res.status(200).json({
      success: true,
      data: {
        bindings,
        myAgentOn,
      },
    });
  } catch (err) {
    logger.error({ err: err?.message }, "getAgentBindings failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to get agent bindings" });
  }
};

export const leave = async (req, res) => {
  try {
    const { address, code, chain } = req.body;
    const user = await User.resolveUserByAddress(address, chain || "BASE");
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
