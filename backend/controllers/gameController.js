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
  ensureUsdcAllowanceFromSmartWalletForTycoon,
  syncBackendPasswordIfMissingOnChain,
} from "../services/tycoonContract.js";
import {
  getGameByCodeStarknet,
  parseGameByCodeResult,
  isStarknetConfigured,
} from "../services/starknetContract.js";
import { ensureUserHasContractPassword, ensureGuestContractPlayReady } from "../utils/ensureContractAuth.js";
import { onGameFinished as tournamentOnGameFinished } from "../services/tournamentService.js";
import {
  augmentNetWorthsWithEliminatedTournamentSeats,
  computeNetWorthResultForGameId,
  placementsFromNetWorths,
} from "../services/gameNetWorthCompute.js";
import { settleStakedArenaForFinishedGame } from "../services/arenaStakeSettlement.js";
import { submitErc8004Feedback as submitErc8004FeedbackTx } from "../services/erc8004Feedback.js";
import { getActiveByGameId } from "./auctionController.js";
import UserAgent from "../models/UserAgent.js";
import Tournament from "../models/Tournament.js";
import TournamentMatch from "../models/TournamentMatch.js";
import agentRegistry from "../services/agentRegistry.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { parseUnits } from "ethers";
import {
  getOnchainAddressForGuestFlow,
  isValidEthAddress as isValidEthAddressForOnchain,
} from "../utils/onchainUserAddress.js";

const isValidEthAddress = isValidEthAddressForOnchain;

const GAME_TYPES = {
  PVP_HUMAN: "PVP_HUMAN",
  AI_HUMAN_VS_AI: "AI_HUMAN_VS_AI",
  AGENT_VS_AI: "AGENT_VS_AI",
  AGENT_VS_AGENT: "AGENT_VS_AGENT",
  TOURNAMENT_AGENT_VS_AGENT: "TOURNAMENT_AGENT_VS_AGENT",
  ONCHAIN_AGENT_VS_AI: "ONCHAIN_AGENT_VS_AI",
  ONCHAIN_AGENT_VS_AGENT: "ONCHAIN_AGENT_VS_AGENT",
  ONCHAIN_HUMAN_VS_AGENT: "ONCHAIN_HUMAN_VS_AGENT",
};

/** Fixed session length for autonomous / on-chain agent games (enables finish-by-time + saved placements). */
const AGENT_GAME_DURATION_MINUTES = 30;

// Prevent duplicate on-chain start attempts when the last seat is accepted
// (multiple users may click accept at nearly the same time).
const ONCHAIN_AGENT_VS_AGENT_START_LOCKS = new Map();

/** Generate a 6-character join code (A–Z, 0–9). */
function generateJoinCode6() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I to reduce confusion
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function normalizeJoinCode(code) {
  const c = code != null ? String(code).trim().toUpperCase() : "";
  return c;
}

/** Bracket / agent tournament tables use codes like T24-R0-M1. */
function gamePayloadLooksLikeTournamentTable(payload) {
  if (!payload || typeof payload !== "object") return false;
  const c = String(payload.code ?? "").trim().toUpperCase();
  if (/^T\d+-R\d+-M\d+$/.test(c)) return true;
  const gt = String(payload.game_type ?? "").toUpperCase();
  return gt.includes("TOURNAMENT");
}

async function enrichGamePayloadWithTournamentLobbyMeta(payload) {
  if (!payload?.id) return payload;
  const match = await TournamentMatch.findByGameId(payload.id);
  if (!match) return payload;
  const tournament = await Tournament.findById(match.tournament_id);
  const vis = String(tournament?.visibility ?? "").toUpperCase();
  const agentStyle = vis === "BOT_SELECTION" || Boolean(Number(tournament?.is_agent_only ?? 0));
  const tournamentLobbyBasePath = agentStyle ? "/agent-tournaments" : "/tournaments";
  return {
    ...payload,
    tournament_id: tournament?.id ?? match.tournament_id,
    tournament_code: tournament?.code ?? null,
    tournament_lobby_base_path: tournamentLobbyBasePath,
  };
}

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

function randomToken48() {
  return crypto.randomBytes(24).toString("hex");
}

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

/**
 * Compute winner by net worth: cash + property values (incl. mortgage) + building resale value + one-turn rent potential.
 * Does not modify DB.
 * @returns { winner_id, net_worths: [{ user_id, net_worth }] } or null if game invalid
 */
async function computeWinnerByNetWorth(game) {
  if (!game || game?.status !== "RUNNING") return null;
  return computeNetWorthResultForGameId(game.id);
}

/** DB statuses that allow finishing a live multiplayer / on-chain session (not PENDING lobby). */
const FINISHABLE_GAME_STATUSES = ["RUNNING", "IN_PROGRESS"];

/**
 * Finish a running game by net worth (winner = highest net worth). Used by finishByTime and by vote-end-by-networth.
 * Updates DB, runs contract cleanup, invalidates cache, emits socket. Does not send HTTP response.
 * @param {object} io - Socket.io server instance (from req.app.get("io"))
 * @param {object} game - Game row (RUNNING or IN_PROGRESS)
 * @returns {Promise<{ winner_id, placements, winner_turn_count, valid_win } | null>}
 */
export async function finishGameByNetWorthAndNotify(io, game) {
  if (!game || !FINISHABLE_GAME_STATUSES.includes(game.status)) return null;
  const result = await computeWinnerByNetWorth(game);
  if (!result || result.winner_id == null) return null;

  const netWorths = await augmentNetWorthsWithEliminatedTournamentSeats(
    game.id,
    game.game_type,
    result.net_worths
  );
  const placements = placementsFromNetWorths(netWorths);

  const updatePayload = { status: "FINISHED", winner_id: result.winner_id, placements: JSON.stringify(placements) };
  const rowCount = await db("games")
    .where({ id: game.id })
    .whereIn("status", FINISHABLE_GAME_STATUSES)
    .update({ ...updatePayload, updated_at: db.fn.now() });

  if (rowCount === 0) return null;

  try {
    await settleStakedArenaForFinishedGame(game.id);
  } catch (err) {
    logger.error({ err: err?.message, gameId: game.id }, "settleStakedArenaForFinishedGame before tournament onGameFinished failed");
  }

  try {
    await tournamentOnGameFinished(game.id);
  } catch (err) {
    logger.error({ err: err?.message, gameId: game.id }, "tournament onGameFinished failed");
  }

  await agentRegistry.cleanupGame(game.id);

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
 * If the session is timed and end time has passed, finish by net worth (same as POST /games/:id/finish-by-time).
 * Used by the HTTP handler and by timedGameFinishPoller.
 *
 * @param {number|string} gameId
 * @param {object|null} io - socket.io server for emitGameUpdate (optional)
 */
export async function tryFinishTimedGameById(gameId, io) {
  try {
    const game = await Game.findById(gameId);
    if (!game) {
      return { outcome: "not_found" };
    }
    if (game.status === "FINISHED" || game.status === "CANCELLED") {
      return {
        outcome: "already_finished",
        game,
        winner_id: game.winner_id,
      };
    }
    if (!FINISHABLE_GAME_STATUSES.includes(game.status)) {
      return { outcome: "bad_request", error: "Game is not running" };
    }

    const durationMinutes = Number(game.duration) || 0;
    if (durationMinutes <= 0) {
      return { outcome: "bad_request", error: "Game has no duration" };
    }
    const startAt = game.started_at || game.created_at;
    const endMs = new Date(startAt).getTime() + durationMinutes * 60 * 1000;
    if (Date.now() < endMs - 30000) {
      return { outcome: "bad_request", error: "Game time has not ended yet" };
    }

    const notifyResult = await finishGameByNetWorthAndNotify(io, game);
    if (!notifyResult) {
      const updated = await Game.findById(game.id);
      if (updated?.status === "FINISHED") {
        return {
          outcome: "already_finished",
          game: updated,
          winner_id: updated.winner_id,
        };
      }
      return { outcome: "bad_request", error: "Could not compute winner" };
    }

    await recordEvent("game_finished", {
      entityType: "game",
      entityId: game.id,
      payload: { winner_id: notifyResult.winner_id },
    });

    const updated = await Game.findById(game.id);
    const parsedPlacements = notifyResult.placements;
    return {
      outcome: "finished",
      data: {
        game: updated,
        winner_id: notifyResult.winner_id,
        winner_turn_count: notifyResult.winner_turn_count || 0,
        valid_win: notifyResult.valid_win !== false,
        placements: parsedPlacements,
      },
    };
  } catch (err) {
    logger.error({ err, gameId }, "tryFinishTimedGameById error");
    return {
      outcome: "error",
      message: err?.message || "Failed to finish game by time",
    };
  }
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
        game_type,
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
        game_type: game_type || (is_ai ? GAME_TYPES.AI_HUMAN_VS_AI : GAME_TYPES.PVP_HUMAN),
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
        try {
          await settleStakedArenaForFinishedGame(Number(req.params.id));
        } catch (err) {
          logger.error(
            { err: err?.message, gameId: req.params.id },
            "settleStakedArenaForFinishedGame on game update FINISHED failed"
          );
        }
        try {
          await tournamentOnGameFinished(Number(req.params.id));
        } catch (err) {
          logger.error(
            { err: err?.message, gameId: req.params.id },
            "tournament onGameFinished on game update FINISHED failed"
          );
        }
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
      const io = req.app.get("io");
      const r = await tryFinishTimedGameById(req.params.id, io);
      if (r.outcome === "not_found") {
        return res.status(404).json({ success: false, error: "Game not found" });
      }
      if (r.outcome === "bad_request") {
        return res.status(400).json({ success: false, error: r.error || "Bad request" });
      }
      if (r.outcome === "error") {
        return res.status(500).json({ success: false, message: r.message || "Failed to finish game by time" });
      }
      if (r.outcome === "already_finished") {
        return res.status(200).json({
          success: true,
          message: "Game already concluded",
          data: { game: r.game, winner_id: r.winner_id, valid_win: true },
        });
      }
      if (r.outcome === "finished") {
        return res.status(200).json({
          success: true,
          message: "Game finished by time; winner by net worth",
          data: r.data,
        });
      }
      return res.status(500).json({ success: false, message: "Unexpected finish-by-time outcome" });
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
      const tag1 = score === 100 ? "starred" : "tycoon";
      const result = await submitErc8004FeedbackTx(agentId, score, "gameResult", tag1);
      if (result.success) {
        return res.status(200).json({ success: true, hash: result.hash });
      }
      return res.status(200).json({ success: true, skipped: true, error: result.error });
    } catch (error) {
      logger.warn({ err: error, gameId: req.params.id }, "submitErc8004Feedback error");
      return res.status(200).json({ success: true, skipped: true, message: error?.message || "Feedback failed" });
    }
  },

  /**
   * POST: Submit ERC-8004 reputation feedback when the user followed an AI tip (e.g. tip said buy and user bought).
   * Call from frontend when user's buy/skip action matches the last tip recommendation.
   * Use 100 on the same scale as gameResult (AI win): explorers show on-chain value as "x/100"; low values read as bad rep.
   */
  async submitErc8004TipFeedback(req, res) {
    try {
      const game = await Game.findById(req.params.id);
      if (!game) return res.status(404).json({ success: false, error: "Game not found" });
      if (!game.is_ai) {
        return res.status(200).json({ success: true, skipped: true, message: "Not an AI game" });
      }
      const agentId = process.env.ERC8004_AGENT_ID;
      if (!agentId || String(agentId).trim() === "") {
        return res.status(200).json({ success: true, skipped: true, message: "ERC8004_AGENT_ID not set" });
      }
      const TIP_FOLLOWED_SCORE = 100;
      const result = await submitErc8004FeedbackTx(agentId, TIP_FOLLOWED_SCORE, "tipFollowed", "starred");
      if (result.success) {
        return res.status(200).json({ success: true, hash: result.hash });
      }
      return res.status(200).json({ success: true, skipped: true, error: result.error });
    } catch (error) {
      logger.warn({ err: error, gameId: req.params.id }, "submitErc8004TipFeedback error");
      return res.status(200).json({ success: true, skipped: true, message: error?.message || "Tip feedback failed" });
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
        let data = cached;
        if (gamePayloadLooksLikeTournamentTable(data)) {
          data = await enrichGamePayloadWithTournamentLobbyMeta(data);
          await setCachedGameByCode(code, data);
        }
        return res.json({
          success: true,
          message: "successful",
          data,
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
      let data = { ...game, settings, players, history, active_auction: active_auction || undefined };
      if (gamePayloadLooksLikeTournamentTable(data)) {
        data = await enrichGamePayloadWithTournamentLobbyMeta(data);
      }
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

/**
 * POST /games/create-agent-vs-agent
 * Body:
 *  - number_of_players: 2..8
 *  - duration?: number (minutes) (optional; 0 or missing => untimed)
 *  - chain?: string (for usernames/user creation; does not require on-chain)
 *  - settings?: house rules (auction, rent_in_prison, mortgage, even_build, randomize_play_order, starting_cash)
 *  - agents: array of length N, each:
 *      { slot: 1..8, user_agent_id?: number } OR { slot, callbackUrl, agentId, name?, chainId? }
 *
 * This creates a RUNNING game where all seats are AI users, and each slot is controlled by an agent binding.
 * It is designed for autonomous backend-runner execution (no browser tab required).
 */
export const createAgentVsAgent = async (req, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const {
      number_of_players,
      chain,
      settings = {},
      agents = [],
      code: rawCode,
    } = req.body || {};

    const n = Math.max(2, Math.min(8, Number(number_of_players) || 0));
    if (!n || n < 2 || n > 8) {
      return res.status(400).json({ success: false, message: "number_of_players must be between 2 and 8" });
    }
    if (!Array.isArray(agents) || agents.length < n) {
      return res.status(400).json({
        success: false,
        message: `agents must be an array with at least ${n} entries (one per slot)`,
      });
    }

    const normalizedChain = User.normalizeChain(chain || "CELO");
    const startingCash = Number(settings?.starting_cash ?? 1500);

    // Use provided code or generate a unique-ish one server-side (fallback).
    let code = normalizeJoinCode(rawCode);
    if (!code) code = generateJoinCode6();
    if (code.length !== 6) {
      return res.status(400).json({ success: false, message: "code must be exactly 6 characters" });
    }

    // Ensure code doesn't already exist
    const existingGame = await Game.findByCode(code);
    if (existingGame) {
      return res.status(400).json({ success: false, message: "Game code already exists" });
    }

    // Create game as RUNNING so the runner can start immediately.
    const game = await Game.create({
      code,
      mode: "PRIVATE",
      creator_id: user.id,
      next_player_id: null, // set after players seeded
      number_of_players: n,
      status: "RUNNING",
      is_minipay: false,
      is_ai: true,
      duration: String(AGENT_GAME_DURATION_MINUTES),
      chain: normalizedChain,
      contract_game_id: null,
      game_type: GAME_TYPES.AGENT_VS_AGENT,
      started_at: db.fn.now(),
    });

    await Chat.create({ game_id: game.id, status: "open" });

    const gs = await GameSetting.create({
      game_id: game.id,
      auction: settings?.auction ?? true,
      rent_in_prison: settings?.rent_in_prison ?? false,
      mortgage: settings?.mortgage ?? true,
      even_build: settings?.even_build ?? true,
      randomize_play_order: settings?.randomize_play_order ?? false,
      starting_cash: startingCash,
      // ai difficulty fields are not relevant here; agent bindings decide behavior
    });

    // Seed players using reserved AI users/addresses (seat 1..N).
    const availableSymbols = [...AI_SYMBOLS];
    const players = [];
    for (let i = 0; i < n; i++) {
      const aiUser = await getOrCreateAIUser(i, normalizedChain);
      if (!aiUser) {
        return res.status(500).json({ success: false, message: `Failed to create AI user for slot ${i + 1}` });
      }
      const sym = availableSymbols[i % availableSymbols.length] || "hat";
      const gp = await GamePlayer.create({
        game_id: game.id,
        user_id: aiUser.id,
        address: aiUser.address,
        balance: startingCash,
        position: 0,
        turn_order: i + 1,
        symbol: sym,
        chance_jail_card: false,
        community_chest_jail_card: false,
      });
      players.push(gp);
    }

    // First turn: seat 1
    const first = players.find((p) => Number(p.turn_order) === 1) || players[0];
    if (first?.user_id) {
      await Game.update(game.id, { next_player_id: first.user_id });
      await GamePlayer.setTurnStart(game.id, first.user_id);
    }

    // Register agent bindings for slots 1..N (game-specific).
    for (let slot = 1; slot <= n; slot++) {
      const entry = agents.find((a) => Number(a?.slot) === slot) || agents[slot - 1];
      if (!entry) continue;
      const payload = {
        gameId: game.id,
        slot,
        agentId: entry.agentId || entry.agent_id || String(entry.user_agent_id || entry.userAgentId || ""),
        callbackUrl: entry.callbackUrl || entry.callback_url || null,
        user_agent_id: entry.user_agent_id || entry.userAgentId || null,
        chainId: entry.chainId || entry.chain_id || 42220,
        name: entry.name || `Agent ${slot}`,
      };
      await agentRegistry.registerAgent(payload);
    }

    await recordEvent("game_created", {
      entityType: "game",
      entityId: game.id,
      payload: { game_type: GAME_TYPES.AGENT_VS_AGENT, number_of_players: n },
    });

    const io = req.app.get("io");
    if (io && game.code) {
      emitGameUpdate(io, game.code);
      io.to(game.code).emit("game-started", { game: await Game.findById(game.id) });
    }

    const fullGame = await Game.findById(game.id);
    const fullPlayers = await GamePlayer.findByGameId(game.id);
    return res.status(201).json({
      success: true,
      data: { ...fullGame, settings: gs, players: fullPlayers },
    });
  } catch (err) {
    logger.error({ err: err?.message }, "createAgentVsAgent failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to create Agent vs Agent game" });
  }
};

/**
 * POST /games/create-agent-vs-ai
 * Body:
 *  - ai_count: 1..7 (opponents). total players = ai_count + 1
 *  - duration?: number (minutes)
 *  - chain?: string
 *  - settings?: house rules
 *  - my_agent: { user_agent_id } OR { callbackUrl, agentId, name?, chainId? } (binds slot 1, game-specific)
 *  - opponent_agents?: array for slots 2..N (optional; if omitted, internal AI fallback is used by agentRegistry)
 *
 * Creates a RUNNING game where slot 1 is controlled by an agent and slots 2..N are AI seats.
 */
export const createAgentVsAI = async (req, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const {
      ai_count,
      chain,
      settings = {},
      my_agent,
      opponent_agents = [],
      code: rawCode,
    } = req.body || {};

    const aiCount = Math.max(1, Math.min(7, Number(ai_count) || 0));
    if (!aiCount) {
      return res.status(400).json({ success: false, message: "ai_count must be between 1 and 7" });
    }
    const n = aiCount + 1;

    if (!my_agent || (my_agent.user_agent_id == null && !my_agent.callbackUrl && !my_agent.callback_url)) {
      return res.status(400).json({ success: false, message: "my_agent is required (user_agent_id or callbackUrl)" });
    }

    const normalizedChain = User.normalizeChain(chain || "CELO");
    const startingCash = Number(settings?.starting_cash ?? 1500);

    let code = normalizeJoinCode(rawCode);
    if (!code) code = generateJoinCode6();
    if (code.length !== 6) {
      return res.status(400).json({ success: false, message: "code must be exactly 6 characters" });
    }

    const existingGame = await Game.findByCode(code);
    if (existingGame) {
      return res.status(400).json({ success: false, message: "Game code already exists" });
    }

    const game = await Game.create({
      code,
      mode: "PRIVATE",
      creator_id: user.id,
      next_player_id: null,
      number_of_players: n,
      status: "RUNNING",
      is_minipay: false,
      is_ai: true,
      duration: String(AGENT_GAME_DURATION_MINUTES),
      chain: normalizedChain,
      contract_game_id: null,
      game_type: GAME_TYPES.AGENT_VS_AI,
      started_at: db.fn.now(),
    });

    await Chat.create({ game_id: game.id, status: "open" });

    const gs = await GameSetting.create({
      game_id: game.id,
      auction: settings?.auction ?? true,
      rent_in_prison: settings?.rent_in_prison ?? false,
      mortgage: settings?.mortgage ?? true,
      even_build: settings?.even_build ?? true,
      randomize_play_order: settings?.randomize_play_order ?? false,
      starting_cash: startingCash,
      ...buildAiDifficultyPayload(settings?.ai_difficulty || "boss", settings?.ai_difficulty_mode || "random", aiCount, true),
    });

    // Seed players: seat 1 is creator's AI user (still a real user row), seats 2..N are AI users.
    const availableSymbols = [...AI_SYMBOLS];
    const players = [];
    for (let i = 0; i < n; i++) {
      const aiUser = await getOrCreateAIUser(i, normalizedChain);
      if (!aiUser) {
        return res.status(500).json({ success: false, message: `Failed to create AI user for slot ${i + 1}` });
      }
      const sym = availableSymbols[i % availableSymbols.length] || "hat";
      const gp = await GamePlayer.create({
        game_id: game.id,
        user_id: aiUser.id,
        address: aiUser.address,
        balance: startingCash,
        position: 0,
        turn_order: i + 1,
        symbol: sym,
        chance_jail_card: false,
        community_chest_jail_card: false,
      });
      players.push(gp);
    }

    const first = players.find((p) => Number(p.turn_order) === 1) || players[0];
    if (first?.user_id) {
      await Game.update(game.id, { next_player_id: first.user_id });
      await GamePlayer.setTurnStart(game.id, first.user_id);
    }

    // Register slot 1 = my agent (game-specific).
    await agentRegistry.registerAgent({
      gameId: game.id,
      slot: 1,
      agentId: my_agent.agentId || my_agent.agent_id || String(my_agent.user_agent_id || my_agent.userAgentId || ""),
      callbackUrl: my_agent.callbackUrl || my_agent.callback_url || null,
      user_agent_id: my_agent.user_agent_id || my_agent.userAgentId || null,
      chainId: my_agent.chainId || my_agent.chain_id || 42220,
      name: my_agent.name || "My Agent",
    });

    // Optional: register opponent agents (slots 2..N)
    if (Array.isArray(opponent_agents)) {
      for (const entry of opponent_agents) {
        const slot = Number(entry?.slot);
        if (!slot || slot < 2 || slot > n) continue;
        await agentRegistry.registerAgent({
          gameId: game.id,
          slot,
          agentId: entry.agentId || entry.agent_id || String(entry.user_agent_id || entry.userAgentId || ""),
          callbackUrl: entry.callbackUrl || entry.callback_url || null,
          user_agent_id: entry.user_agent_id || entry.userAgentId || null,
          chainId: entry.chainId || entry.chain_id || 42220,
          name: entry.name || `Agent ${slot}`,
        });
      }
    }

    await recordEvent("game_created", {
      entityType: "game",
      entityId: game.id,
      payload: { game_type: GAME_TYPES.AGENT_VS_AI, ai_count: aiCount },
    });

    const io = req.app.get("io");
    if (io && game.code) {
      emitGameUpdate(io, game.code);
      io.to(game.code).emit("game-started", { game: await Game.findById(game.id) });
    }

    const fullGame = await Game.findById(game.id);
    const fullPlayers = await GamePlayer.findByGameId(game.id);
    return res.status(201).json({
      success: true,
      data: { ...fullGame, settings: gs, players: fullPlayers },
    });
  } catch (err) {
    logger.error({ err: err?.message }, "createAgentVsAI failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to create Agent vs AI game" });
  }
};

/**
 * POST /games/create-onchain-agent-vs-ai
 * Creates an on-chain AI game for the authenticated user (slot 1), then binds slot 1 to the selected agent.
 * Body:
 *  - ai_count: 1..7 (opponents)
 *  - duration?: number (minutes) (0 => untimed)
 *  - chain?: string
 *  - settings?: house rules (starting_cash, auction, rent_in_prison, mortgage, even_build, randomize_play_order, ai_difficulty, ai_difficulty_mode)
 *  - my_agent: { user_agent_id, name? } OR { callbackUrl, agentId, name?, chainId? }
 *  - code?: 6-char join code (optional; server generates if omitted)
 *  - symbol?: token symbol for the player (default "hat")
 */
export const createOnchainAgentVsAI = async (req, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const {
      ai_count,
      chain,
      settings = {},
      my_agent,
      code: rawCode,
      symbol,
    } = req.body || {};

    const aiCount = Math.max(1, Math.min(7, Number(ai_count) || 0));
    if (!aiCount) {
      return res.status(400).json({ success: false, message: "ai_count must be between 1 and 7" });
    }
    if (!my_agent || (my_agent.user_agent_id == null && !my_agent.callbackUrl && !my_agent.callback_url)) {
      return res.status(400).json({ success: false, message: "my_agent is required (user_agent_id or callbackUrl)" });
    }

    const chainForCreate = User.normalizeChain(chain || "CELO");
    const startingCash = Number(settings?.starting_cash ?? 1500);

    let code = normalizeJoinCode(rawCode);
    if (!code) code = generateJoinCode6();
    if (code.length !== 6) {
      return res.status(400).json({ success: false, message: "code must be exactly 6 characters" });
    }
    const existingGame = await Game.findByCode(code);
    if (existingGame) {
      return res.status(400).json({ success: false, message: "Game code already exists" });
    }

    const rPlay = await ensureGuestContractPlayReady(db, user, chainForCreate);
    if (!rPlay.ok) {
      return res.status(403).json({
        success: false,
        code: "ONCHAIN_PLAYER_SETUP_FAILED",
        message:
          "Your account is not set up for play on this network. Open Profile once, link a wallet if needed, then try again.",
        reason: rPlay.reason,
      });
    }
    const contractUser = {
      address: rPlay.address,
      username: rPlay.username,
      password_hash: rPlay.password_hash,
    };

    await syncBackendPasswordIfMissingOnChain(
      contractUser.address,
      contractUser.password_hash,
      contractUser.username,
      startingCash,
      chainForCreate,
      { mode: "ai", numberOfAI: aiCount }
    );

    const gameType = "PRIVATE";
    const playerSymbol = String(symbol || "hat").trim().toLowerCase() || "hat";
    const gameCodeForContract = code.trim().toUpperCase();

    const { gameId: onChainGameIdFromEvent } = await createAIGameByBackend(
      contractUser.address,
      contractUser.password_hash,
      contractUser.username,
      gameType,
      playerSymbol,
      aiCount,
      gameCodeForContract,
      startingCash,
      chainForCreate
    );

    let onChainGameId = onChainGameIdFromEvent;
    if (!onChainGameId && gameCodeForContract) {
      try {
        const contractGame = await callContractRead("getGameByCode", [gameCodeForContract], chainForCreate);
        const id = contractGame?.id ?? contractGame?.[0];
        if (id != null) onChainGameId = String(id);
      } catch (lookupErr) {
        logger.warn({ err: lookupErr?.message, code: gameCodeForContract }, "getGameByCode fallback failed after createAIGameByBackend");
      }
    }

    if (!onChainGameId) {
      return res.status(500).json({ success: false, message: "Contract did not return game ID" });
    }

    const game = await Game.create({
      code,
      mode: "PRIVATE",
      creator_id: user.id,
      next_player_id: user.id,
      number_of_players: aiCount + 1,
      status: "RUNNING",
      is_minipay: false,
      is_ai: true,
      duration: String(AGENT_GAME_DURATION_MINUTES),
      chain: chainForCreate,
      contract_game_id: String(onChainGameId),
      game_type: GAME_TYPES.ONCHAIN_AGENT_VS_AI,
      started_at: db.fn.now(),
    });

    await Chat.create({ game_id: game.id, status: "open" });

    const aiDiffPayload = buildAiDifficultyPayload(
      settings?.ai_difficulty || "boss",
      settings?.ai_difficulty_mode || "random",
      aiCount,
      true
    );
    const gs = await GameSetting.create({
      game_id: game.id,
      auction: settings?.auction ?? true,
      rent_in_prison: settings?.rent_in_prison ?? false,
      mortgage: settings?.mortgage ?? true,
      even_build: settings?.even_build ?? true,
      randomize_play_order: settings?.randomize_play_order ?? false,
      starting_cash: startingCash,
      ...aiDiffPayload,
    });

    // Seat 1: the real user (on-chain address)
    await GamePlayer.create({
      game_id: game.id,
      user_id: user.id,
      address: contractUser.address,
      balance: startingCash,
      position: 0,
      turn_order: 1,
      symbol: playerSymbol,
      chance_jail_card: false,
      community_chest_jail_card: false,
    });

    // Seats 2..N: AI users in DB (so UI has full roster immediately)
    const availableSymbols = AI_SYMBOLS.filter((s) => s !== playerSymbol);
    for (let i = 0; i < aiCount; i++) {
      const aiUser = await getOrCreateAIUser(i, chainForCreate);
      if (!aiUser) continue;
      const aiSymbol = availableSymbols[i % availableSymbols.length] || AI_SYMBOLS[i % AI_SYMBOLS.length] || "car";
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

    await GamePlayer.setTurnStart(game.id, user.id);

    // Bind slot 1 to the chosen agent so the board can auto-play the user's seat.
    await agentRegistry.registerAgent({
      gameId: game.id,
      slot: 1,
      agentId: my_agent.agentId || my_agent.agent_id || String(my_agent.user_agent_id || my_agent.userAgentId || ""),
      callbackUrl: my_agent.callbackUrl || my_agent.callback_url || null,
      user_agent_id: my_agent.user_agent_id || my_agent.userAgentId || null,
      chainId: my_agent.chainId || my_agent.chain_id || 42220,
      name: my_agent.name || "My Agent",
    });

    await recordEvent("game_created", {
      entityType: "game",
      entityId: game.id,
      payload: { game_type: GAME_TYPES.ONCHAIN_AGENT_VS_AI, ai_count: aiCount, on_chain: true },
    });

    const io = req.app.get("io");
    if (io && game.code) {
      emitGameUpdate(io, game.code);
      io.to(game.code).emit("game-started", { game: await Game.findById(game.id) });
    }

    const fullGame = await Game.findById(game.id);
    const fullPlayers = await GamePlayer.findByGameId(game.id);
    return res.status(201).json({
      success: true,
      data: { ...fullGame, settings: gs, players: fullPlayers },
    });
  } catch (err) {
    logger.error({ err: err?.message }, "createOnchainAgentVsAI failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to create on-chain Agent vs AI game" });
  }
};

/**
 * POST /games/create-onchain-agent-vs-agent-lobby
 * Creates a DB lobby for an on-chain multiplayer agent-vs-agent game, with per-slot invite tokens.
 * Slot 1 is immediately accepted by the creator (must provide my_agent).
 *
 * Body:
 *  - number_of_players: 2..8
 *  - duration?: number (minutes)
 *  - chain?: string
 *  - settings?: house rules (starting_cash, auction, rent_in_prison, mortgage, even_build, randomize_play_order)
 *  - my_agent: { user_agent_id, name? } OR { callbackUrl, agentId, name?, chainId? }
 *  - code?: 6-char join code (optional; server generates if omitted)
 *  - agents?: optional array to prefill additional slots owned by creator: [{ slot, user_agent_id, name? }]
 */
export const createOnchainAgentVsAgentLobby = async (req, res) => {
  try {
    const user = req.user;
    if (!user?.id) return res.status(401).json({ success: false, message: "Authentication required" });

    const {
      number_of_players,
      chain,
      settings = {},
      my_agent,
      agents: prefillAgents = [],
      code: rawCode,
    } = req.body || {};

    const n = Math.max(2, Math.min(8, Number(number_of_players) || 0));
    if (!n) return res.status(400).json({ success: false, message: "number_of_players must be 2..8" });
    if (!my_agent || (my_agent.user_agent_id == null && !my_agent.callbackUrl && !my_agent.callback_url)) {
      return res.status(400).json({ success: false, message: "my_agent is required (user_agent_id or callbackUrl)" });
    }

    const chainForLobby = User.normalizeChain(chain || "CELO");
    const startingCash = Number(settings?.starting_cash ?? 1500);

    let code = normalizeJoinCode(rawCode);
    if (!code) code = generateJoinCode6();
    if (code.length !== 6) return res.status(400).json({ success: false, message: "code must be exactly 6 characters" });
    const existingGame = await Game.findByCode(code);
    if (existingGame) return res.status(400).json({ success: false, message: "Game code already exists" });

    const game = await Game.create({
      code,
      mode: "PRIVATE",
      creator_id: user.id,
      next_player_id: null,
      number_of_players: n,
      status: "PENDING",
      is_minipay: false,
      is_ai: false,
      duration: String(AGENT_GAME_DURATION_MINUTES),
      chain: chainForLobby,
      contract_game_id: null,
      game_type: GAME_TYPES.ONCHAIN_AGENT_VS_AGENT,
      started_at: null,
    });

    await Chat.create({ game_id: game.id, status: "open" });

    const gs = await GameSetting.create({
      game_id: game.id,
      auction: settings?.auction ?? true,
      rent_in_prison: settings?.rent_in_prison ?? false,
      mortgage: settings?.mortgage ?? true,
      even_build: settings?.even_build ?? true,
      randomize_play_order: settings?.randomize_play_order ?? false,
      starting_cash: startingCash,
    });

    // Create invite tokens for each slot.
    const invites = [];
    for (let slot = 1; slot <= n; slot++) {
      invites.push({
        game_id: game.id,
        slot,
        token: randomToken48(),
        status: "OPEN",
        owner_user_id: null,
        user_agent_id: null,
        agent_name: null,
        expires_at: null,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
    }
    await db("agent_game_invites").insert(invites);

    // Accept slot 1 (creator) immediately.
    const myAgentName = my_agent.name || "My Agent";
    const myAgentId = my_agent.user_agent_id ? Number(my_agent.user_agent_id) : null;
    if (myAgentId) {
      const agent = await UserAgent.findById(myAgentId);
      if (!agent || Number(agent.user_id) !== Number(user.id)) {
        return res.status(403).json({ success: false, message: "You can only use your own agent for slot 1" });
      }
    }
    await db("agent_game_invites")
      .where({ game_id: game.id, slot: 1 })
      .update({
        status: "ACCEPTED",
        owner_user_id: user.id,
        user_agent_id: myAgentId,
        agent_name: myAgentName,
        updated_at: db.fn.now(),
      });

    await agentRegistry.registerAgent({
      gameId: game.id,
      slot: 1,
      agentId: my_agent.agentId || my_agent.agent_id || String(my_agent.user_agent_id || my_agent.userAgentId || ""),
      callbackUrl: my_agent.callbackUrl || my_agent.callback_url || null,
      user_agent_id: my_agent.user_agent_id || my_agent.userAgentId || null,
      chainId: my_agent.chainId || my_agent.chain_id || 42220,
      name: myAgentName,
    });

    // Optional prefill: creator can claim additional slots with their own agents (useful for "my agents fight").
    if (Array.isArray(prefillAgents)) {
      for (const entry of prefillAgents) {
        const slot = Number(entry?.slot);
        const userAgentId = Number(entry?.user_agent_id);
        if (!slot || slot < 2 || slot > n) continue;
        if (!userAgentId) continue;
        const agent = await UserAgent.findById(userAgentId);
        if (!agent || Number(agent.user_id) !== Number(user.id)) continue;
        const agentName = entry?.name || agent.name || `Agent ${slot}`;
        await db("agent_game_invites")
          .where({ game_id: game.id, slot })
          .update({
            status: "ACCEPTED",
            owner_user_id: user.id,
            user_agent_id: userAgentId,
            agent_name: agentName,
            updated_at: db.fn.now(),
          });
        await agentRegistry.registerAgent({
          gameId: game.id,
          slot,
          agentId: String(userAgentId),
          user_agent_id: userAgentId,
          chainId: 42220,
          name: agentName,
        });
      }
    }

    const rows = await db("agent_game_invites").where({ game_id: game.id }).orderBy("slot", "asc");
    await recordEvent("agent_lobby_created", {
      entityType: "game",
      entityId: game.id,
      payload: { game_type: GAME_TYPES.ONCHAIN_AGENT_VS_AGENT, number_of_players: n },
    });

    return res.status(201).json({
      success: true,
      data: { ...(await Game.findById(game.id)), settings: gs, invites: rows },
    });
  } catch (err) {
    logger.error({ err: err?.message }, "createOnchainAgentVsAgentLobby failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to create on-chain Agent vs Agent lobby" });
  }
};

/**
 * GET /games/:id/agent-vs-agent-lobby
 * Returns lobby game + invite slot states.
 */
export const getOnchainAgentVsAgentLobby = async (req, res) => {
  try {
    const gameId = Number(req.params.id);
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ success: false, message: "Game not found" });
    if (game.game_type !== GAME_TYPES.ONCHAIN_AGENT_VS_AGENT) {
      return res.status(400).json({ success: false, message: "Not an on-chain Agent vs Agent lobby" });
    }
    const invites = await db("agent_game_invites").where({ game_id: gameId }).orderBy("slot", "asc");
    const settings = await GameSetting.findByGameId(gameId);
    return res.status(200).json({ success: true, data: { ...game, settings, invites } });
  } catch (err) {
    logger.error({ err: err?.message }, "getOnchainAgentVsAgentLobby failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to load lobby" });
  }
};

/**
 * POST /games/:id/accept-agent-seat
 * Claim a slot in an on-chain agent-vs-agent lobby.
 * Body: { token, user_agent_id, name? }
 */
export const acceptAgentSeat = async (req, res) => {
  try {
    const user = req.user;
    if (!user?.id) return res.status(401).json({ success: false, message: "Authentication required" });

    const gameId = Number(req.params.id);
    const { token, user_agent_id, name } = req.body || {};
    if (!token) return res.status(400).json({ success: false, message: "token is required" });
    const uaid = Number(user_agent_id);
    if (!uaid) return res.status(400).json({ success: false, message: "user_agent_id is required" });

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ success: false, message: "Game not found" });
    if (game.game_type !== GAME_TYPES.ONCHAIN_AGENT_VS_AGENT) {
      return res.status(400).json({ success: false, message: "Not an on-chain Agent vs Agent lobby" });
    }
    if (game.status !== "PENDING") {
      return res.status(400).json({ success: false, message: "Lobby is not open for joining" });
    }

    const invite = await db("agent_game_invites").where({ game_id: gameId, token: String(token) }).first();
    if (!invite) return res.status(404).json({ success: false, message: "Invite not found" });
    if (invite.status !== "OPEN") {
      return res.status(400).json({ success: false, message: "This seat is not available" });
    }

    const agent = await UserAgent.findById(uaid);
    if (!agent || Number(agent.user_id) !== Number(user.id)) {
      return res.status(403).json({ success: false, message: "You can only accept with an agent you own" });
    }

    const agentName = String(name || agent.name || `Agent ${invite.slot}`).slice(0, 128);
    await db("agent_game_invites")
      .where({ id: invite.id })
      .update({
        status: "ACCEPTED",
        owner_user_id: user.id,
        user_agent_id: uaid,
        agent_name: agentName,
        updated_at: db.fn.now(),
      });

    await agentRegistry.registerAgent({
      gameId,
      slot: Number(invite.slot),
      agentId: String(uaid),
      user_agent_id: uaid,
      chainId: 42220,
      name: agentName,
    });

    const invites = await db("agent_game_invites").where({ game_id: gameId }).orderBy("slot", "asc");
    const ready = invites.length === Number(game.number_of_players) && invites.every((r) => r.status === "ACCEPTED");

    // If this was the last seat, start the on-chain game automatically.
    // This removes the "creator manual start" step.
    if (ready) {
      void withOnchainAgentVsAgentStartLock(gameId, () =>
        startOnchainAgentVsAgentInternal({ req, gameId, starterUserId: user.id })
      ).catch((err) => {
        // Accept-seat should still succeed even if the start fails (auth/pin issues, etc.)
        logger.warn({ err: err?.message, gameId }, "auto-start on-chain agent vs agent failed");
      });
    }

    return res.status(200).json({ success: true, data: { invites, ready } });
  } catch (err) {
    logger.error({ err: err?.message }, "acceptAgentSeat failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to accept seat" });
  }
};

/**
 * POST /games/:id/start-onchain-agent-vs-agent
 * Once all seats are accepted, create the on-chain game and join all owners.
 * Any accepted owner can trigger this start (and it is also auto-triggered after the last seat is accepted).
 * Body: { chain?: string }
 */
function withOnchainAgentVsAgentStartLock(gameId, fn) {
  const id = Number(gameId);
  const prev = ONCHAIN_AGENT_VS_AGENT_START_LOCKS.get(id) || Promise.resolve();
  const next = prev
    .then(fn)
    .finally(() => {
      if (ONCHAIN_AGENT_VS_AGENT_START_LOCKS.get(id) === next) {
        ONCHAIN_AGENT_VS_AGENT_START_LOCKS.delete(id);
      }
    });
  ONCHAIN_AGENT_VS_AGENT_START_LOCKS.set(id, next.catch(() => {}));
  return next;
}

async function startOnchainAgentVsAgentInternal({ req, gameId, starterUserId }) {
  const game = await Game.findById(gameId);
  if (!game) throw new Error("Game not found");
  if (game.game_type !== GAME_TYPES.ONCHAIN_AGENT_VS_AGENT) throw new Error("Not an on-chain Agent vs Agent lobby");
  if (game.contract_game_id) throw new Error("Game already started on-chain");

  const invites = await db("agent_game_invites").where({ game_id: gameId }).orderBy("slot", "asc");
  const n = Number(game.number_of_players);
  if (invites.length !== n || invites.some((r) => r.status !== "ACCEPTED" || !r.owner_user_id || !r.user_agent_id)) {
    throw new Error("All seats must be accepted before starting");
  }

  // Only allow an accepted owner to trigger.
  if (starterUserId != null) {
    const starterAllowed = invites.some(
      (r) => Number(r.owner_user_id) === Number(starterUserId) && r.status === "ACCEPTED"
    );
    if (!starterAllowed) throw new Error("You are not allowed to start this lobby");
  }

  const chainForStart = User.normalizeChain(req.body?.chain || game.chain || "CELO");
  const settings = await GameSetting.findByGameId(gameId);
  const startingCash = Number(settings?.starting_cash ?? 1500);
  const gameType = "PRIVATE";
  const gameCodeForContract = String(game.code || "").trim().toUpperCase();

  // Ensure each owner has contract auth and fetch usernames.
  const ownerById = new Map();
  for (const row of invites) {
    const ownerId = Number(row.owner_user_id);
    if (!ownerById.has(ownerId)) {
      const u = await User.findById(ownerId);
      if (!u) throw new Error(`Owner user not found for slot ${row.slot}`);
      ownerById.set(ownerId, u);
    }
  }

  const contractByOwnerId = new Map();
  for (const [ownerId, owner] of ownerById.entries()) {
    const rPlay = await ensureGuestContractPlayReady(db, owner, chainForStart);
    if (!rPlay.ok) {
      throw new Error(
        `Player for owner ${owner.username} is not set up for on-chain play on ${chainForStart}: ${rPlay.reason}`
      );
    }
    contractByOwnerId.set(ownerId, {
      address: rPlay.address,
      username: rPlay.username,
      password_hash: rPlay.password_hash,
    });
  }

  // Create on-chain game with creator (slot 1).
  const slot1 = invites.find((r) => Number(r.slot) === 1);
  const creatorContract = contractByOwnerId.get(Number(slot1.owner_user_id));
  const creatorSymbol = AI_SYMBOLS[0] || "hat";

  const createResult = await createGameByBackend(
    creatorContract.address,
    creatorContract.password_hash,
    creatorContract.username,
    gameType,
    creatorSymbol,
    n,
    gameCodeForContract,
    startingCash,
    0n,
    chainForStart
  );
  const onChainGameId = createResult?.gameId;
  if (!onChainGameId) throw new Error("Contract did not return game ID");

  // Join remaining players on-chain.
  for (const row of invites) {
    if (Number(row.slot) === 1) continue;
    const contractUser = contractByOwnerId.get(Number(row.owner_user_id));
    const sym =
      AI_SYMBOLS[Number(row.slot) - 1] ||
      AI_SYMBOLS[(Number(row.slot) - 1) % AI_SYMBOLS.length] ||
      "car";
    await joinGameByBackend(
      contractUser.address,
      contractUser.password_hash,
      onChainGameId,
      contractUser.username,
      sym,
      gameCodeForContract,
      chainForStart
    );
  }

  // Seed DB game_players for all owners (one per slot).
  for (const row of invites) {
    const ownerId = Number(row.owner_user_id);
    const contractUser = contractByOwnerId.get(ownerId);
    const sym =
      AI_SYMBOLS[Number(row.slot) - 1] ||
      AI_SYMBOLS[(Number(row.slot) - 1) % AI_SYMBOLS.length] ||
      "car";
    await GamePlayer.create({
      game_id: gameId,
      user_id: ownerId,
      address: contractUser.address,
      balance: startingCash,
      position: 0,
      turn_order: Number(row.slot),
      symbol: sym,
      chance_jail_card: false,
      community_chest_jail_card: false,
    });
  }

  await Game.update(gameId, {
    contract_game_id: String(onChainGameId),
    status: "RUNNING",
    started_at: db.fn.now(),
    next_player_id: Number(slot1.owner_user_id),
    chain: chainForStart,
  });
  await GamePlayer.setTurnStart(gameId, Number(slot1.owner_user_id));

  await recordEvent("game_started", {
    entityType: "game",
    entityId: gameId,
    payload: { game_type: GAME_TYPES.ONCHAIN_AGENT_VS_AGENT, on_chain: true },
  });

  const io = req.app.get("io");
  if (io && game.code) {
    await invalidateGameByCode(game.code);
    emitGameUpdate(io, game.code);
    io.to(game.code).emit("game-started", { game: await Game.findById(gameId) });
  }

  const fullGame = await Game.findById(gameId);
  const fullPlayers = await GamePlayer.findByGameId(gameId);
  return { fullGame, fullPlayers };
}

export const startOnchainAgentVsAgent = async (req, res) => {
  try {
    const user = req.user;
    if (!user?.id) return res.status(401).json({ success: false, message: "Authentication required" });

    const gameId = Number(req.params.id);
    const result = await withOnchainAgentVsAgentStartLock(gameId, () =>
      startOnchainAgentVsAgentInternal({
        req,
        gameId,
        starterUserId: user.id,
      })
    );

    return res.status(200).json({ success: true, data: { ...result.fullGame, players: result.fullPlayers } });
  } catch (err) {
    logger.error({ err: err?.message }, "startOnchainAgentVsAgent failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to start on-chain Agent vs Agent game" });
  }
};

/**
 * POST /games/:id/register-opponent-agent
 * Host-only. Binds an agent to a slot (2..8) for this game (game-specific binding).
 * Body: { slot, user_agent_id? } OR { slot, callbackUrl, agentId, name?, chainId? }
 */
export const registerOpponentAgent = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });

    const gameId = Number(req.params.id);
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ success: false, message: "Game not found" });
    if (Number(game.creator_id) !== Number(userId)) {
      return res.status(403).json({ success: false, message: "Only the game creator can register opponent agents" });
    }

    const { slot, user_agent_id, callbackUrl, callback_url, agentId, agent_id, name, chainId, chain_id } = req.body || {};
    const s = Number(slot);
    if (!s || s < 2 || s > 8) return res.status(400).json({ success: false, message: "slot must be 2..8" });

    const payload = {
      gameId,
      slot: s,
      agentId: agentId || agent_id || String(user_agent_id || ""),
      callbackUrl: callbackUrl || callback_url || null,
      user_agent_id: user_agent_id || null,
      chainId: chainId || chain_id || 42220,
      name: name || `Agent ${s}`,
    };
    const result = await agentRegistry.registerAgent(payload);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    logger.error({ err: err?.message }, "registerOpponentAgent failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to register opponent agent" });
  }
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
      game_type,
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
      game_type: game_type || (is_ai ? GAME_TYPES.AI_HUMAN_VS_AI : GAME_TYPES.PVP_HUMAN),
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

/** True if this user can use guest create/join (backend signs for them). */
function canUseGuestFlow(user) {
  return user && (user.is_guest === true || (user.privy_did && String(user.privy_did).trim()));
}

/** 403 when ensureGuestContractPlayReady fails — includes `reason` for debugging (RPC, env, registration). */
function jsonGuestOnchainSetupFailed(res, reason, forJoin = false) {
  return res.status(403).json({
    success: false,
    code: "ONCHAIN_PLAYER_SETUP_FAILED",
    message: forJoin
      ? "Your account could not be prepared to join on this network. Open Profile once, link a wallet if needed, and use the same chain as the game."
      : "Your account could not be prepared to create games on this network. Open Profile once, link a wallet if needed, or confirm the server has the game contract and RPC configured for this chain.",
    reason: reason || "Unknown",
  });
}

/**
 * Staked guest games: stake USDC lives on the TycoonUserWallet. Register that address on Tycoon (if needed),
 * verify withdrawal PIN, then approve USDC to the game contract via executeCallWithAuth.
 */
async function assertGuestSmartWalletStakeReady({ reqUserId, chain, pin, stakeAmount }) {
  const pinStr = pin != null ? String(pin).trim() : "";
  if (!pinStr) {
    const err = new Error("PIN_REQUIRED");
    err.code = "PIN_REQUIRED";
    throw err;
  }
  const user = await User.findById(reqUserId);
  if (!user?.withdrawal_pin_hash) {
    const err = new Error("Set a withdrawal PIN in Profile to stake from your smart wallet.");
    err.code = "NO_PIN";
    throw err;
  }
  const ok = await bcrypt.compare(pinStr, user.withdrawal_pin_hash);
  if (!ok) {
    const err = new Error("Invalid PIN.");
    err.code = "BAD_PIN";
    throw err;
  }
  const smart = user.smart_wallet_address && String(user.smart_wallet_address).trim();
  if (!isValidEthAddress(smart)) {
    const err = new Error("Create a smart wallet in Profile first (staked games use your smart wallet balance).");
    err.code = "NO_SMART_WALLET";
    throw err;
  }
  const contractUser = await ensureUserHasContractPassword(db, user.id, chain, smart);
  if (!contractUser?.password_hash) {
    const err = new Error("Could not set up on-chain play for your smart wallet. Try again or contact support.");
    err.code = "NO_CONTRACT_USER";
    throw err;
  }
  if (stakeAmount > 0n) {
    await ensureUsdcAllowanceFromSmartWalletForTycoon(smart, stakeAmount, chain);
  }
  return contractUser;
}

function respondGuestStakeSetupError(err, res) {
  const code = err?.code;
  if (code === "PIN_REQUIRED") {
    return res.status(400).json({
      success: false,
      message: "Enter your withdrawal PIN to use your smart wallet for stakes (same PIN as shop withdrawals).",
    });
  }
  if (code === "BAD_PIN") {
    return res.status(401).json({ success: false, message: err.message });
  }
  if (code === "NO_PIN" || code === "NO_SMART_WALLET" || code === "NO_CONTRACT_USER") {
    return res.status(400).json({ success: false, message: err.message });
  }
  return null;
}

/**
 * POST /games/create-as-guest
 * Body: same as POST /games but without address (use req.user from auth).
 * Requires Authorization: Bearer <token> and guest/Privy user; backend ensures contract password.
 */
export const createAsGuest = async (req, res) => {
  try {
    const user = req.user;
    if (!canUseGuestFlow(user)) {
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
    const isAI = !!is_ai;

    let stakeAmount = 0n;
    if (stakeNum > 0) {
      if (isAI) {
        return res.status(400).json({
          success: false,
          message: "Guest AI games cannot be staked.",
        });
      }
      try {
        stakeAmount = parseUnits(String(stakeNum), 6);
      } catch {
        return res.status(400).json({ success: false, message: "Invalid stake amount" });
      }
    }

    const startingCash = settings?.starting_cash ?? 1500;
    const gameType = mode === "PRIVATE" ? "PRIVATE" : "PUBLIC";
    const chainForCreate = User.normalizeChain(chain || "CELO");

    let contractUser;
    if (stakeAmount > 0n) {
      try {
        contractUser = await assertGuestSmartWalletStakeReady({
          reqUserId: user.id,
          chain: chainForCreate,
          pin: req.body?.pin,
          stakeAmount,
        });
      } catch (err) {
        const handled = respondGuestStakeSetupError(err, res);
        if (handled) return handled;
        throw err;
      }
      try {
        const minStake = await callContractRead("minStake", [], chainForCreate);
        const minB = BigInt(minStake ?? 0);
        if (minB > 0n && stakeAmount < minB) {
          return res.status(400).json({
            success: false,
            message: `Stake must be at least ${(Number(minB) / 1e6).toFixed(6)} USDC on this network.`,
          });
        }
      } catch (minErr) {
        logger.warn({ err: minErr?.message }, "createAsGuest: minStake read failed, continuing");
      }
    } else {
      // Free games: linked EOA, smart wallet (wallet-first Privy), or placeholder.
      const rPlay = await ensureGuestContractPlayReady(db, user, chainForCreate);
      if (!rPlay.ok) {
        return jsonGuestOnchainSetupFailed(res, rPlay.reason, false);
      }
      contractUser = {
        address: rPlay.address,
        username: rPlay.username,
        password_hash: rPlay.password_hash,
      };
    }
    const numberOfAI = isAI ? Math.max(1, (number_of_players ?? 2) - 1) : 0;
    const numberOfPlayersProbe = Math.max(
      2,
      Math.min(8, Number(number_of_players) || (isAI ? numberOfAI + 1 : 4))
    );
    await syncBackendPasswordIfMissingOnChain(
      contractUser.address,
      contractUser.password_hash,
      contractUser.username,
      startingCash,
      chainForCreate,
      isAI ? { mode: "ai", numberOfAI } : { mode: "game", numberOfPlayers: numberOfPlayersProbe }
    );

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

    if (!onChainGameId && code) {
      try {
        const gameCodeForLookup = (code || "").trim();
        const contractGame = await callContractRead("getGameByCode", [gameCodeForLookup], chainForCreate);
        const id = contractGame?.id ?? contractGame?.[0];
        if (id != null) onChainGameId = String(id);
      } catch (lookupErr) {
        logger.warn({ err: lookupErr?.message, code }, "getGameByCode fallback failed after guest createGame/AIGame");
      }
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
      address: contractUser.address,
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
    const msg = err?.message || String(err);
    if (/No password set/i.test(msg)) {
      return res.status(403).json({
        success: false,
        message: "Your account is not set up for play on this network. Try linking a wallet in Profile and registering on-chain, or create a new guest game.",
      });
    }
    logger.error({ err: err?.message }, "createAsGuest failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to create game" });
  }
};

/**
 * POST /games/create-multiplayer-as-guest
 * Same as POST /games/create-as-guest with is_ai: false. Matches create-ai-as-guest as a dedicated human-lobby endpoint.
 */
export const createMultiplayerAsGuest = async (req, res) => {
  if (req.body?.is_ai) {
    return res.status(400).json({
      success: false,
      message: "Use POST /games/create-ai-as-guest for AI games.",
    });
  }
  req.body = { ...req.body, is_ai: false };
  return createAsGuest(req, res);
};

/**
 * POST /games/join-as-guest
 * Body: { code, symbol, joinCode? }
 * Requires Authorization: Bearer <token> and guest/Privy user.
 */
export const joinAsGuest = async (req, res) => {
  try {
    const user = req.user;
    if (!canUseGuestFlow(user)) {
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

    let contractUser;
    if (stakePerPlayer > 0n) {
      try {
        contractUser = await assertGuestSmartWalletStakeReady({
          reqUserId: user.id,
          chain: chainForJoin,
          pin: req.body?.pin,
          stakeAmount: stakePerPlayer,
        });
      } catch (err) {
        const handled = respondGuestStakeSetupError(err, res);
        if (handled) return handled;
        throw err;
      }
    } else {
      const rPlay = await ensureGuestContractPlayReady(db, user, chainForJoin);
      if (!rPlay.ok) {
        return jsonGuestOnchainSetupFailed(res, rPlay.reason, true);
      }
      contractUser = {
        address: rPlay.address,
        username: rPlay.username,
        password_hash: rPlay.password_hash,
      };
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
    const msg = err?.message || String(err);
    if (/No password set/i.test(msg)) {
      return res.status(403).json({
        success: false,
        message: "Your account is not set up for play on this network. Try linking a wallet in Profile and registering on-chain.",
      });
    }
    logger.error({ err: err?.message }, "joinAsGuest failed");
    recordEvent("error", { payload: { code: "join_as_guest", message: msg.slice(0, 200) } }).catch(() => {});
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
    if (!canUseGuestFlow(user)) {
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

    const rPlay = await ensureGuestContractPlayReady(db, user, chainForAICreate);
    if (!rPlay.ok) {
      return jsonGuestOnchainSetupFailed(res, rPlay.reason, false);
    }
    const contractUser = {
      address: rPlay.address,
      username: rPlay.username,
      password_hash: rPlay.password_hash,
    };

    await syncBackendPasswordIfMissingOnChain(
      contractUser.address,
      contractUser.password_hash,
      contractUser.username,
      startingCash,
      chainForAICreate,
      { mode: "ai", numberOfAI }
    );

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

    const io = req.app.get("io");
    await Game.update(game.id, { status: "RUNNING", started_at: db.fn.now() });
    await recordEvent("game_started", { entityType: "game", entityId: game.id, payload: {} });
    await invalidateGameById(game.id);
    const updatedGame = await Game.findByCode(game.code);
    if (updatedGame?.next_player_id) {
      await GamePlayer.setTurnStart(game.id, updatedGame.next_player_id);
    }
    const playersWithTurnStart = await GamePlayer.findByGameId(game.id);
    if (io) {
      emitGameUpdate(io, game.code);
      io.to(game.code).emit("game-created", {
        game: { ...updatedGame, settings: game_settings, players: playersWithTurnStart },
      });
      io.to(game.code).emit("game-ready", { game: updatedGame, players: playersWithTurnStart });
    }

    return res.status(201).json({
      success: true,
      message: "successful",
      data: { ...updatedGame, settings: game_settings, players: playersWithTurnStart },
    });
  } catch (err) {
    const msg = err?.message || String(err);
    if (/No password set/i.test(msg)) {
      return res.status(403).json({
        success: false,
        message: "Your account is not set up for play on this network. Try linking a wallet in Profile and registering on-chain, or create a new guest game.",
      });
    }
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
