import crypto from "crypto";
import PlayerChallenge from "../models/PlayerChallenge.js";
import User from "../models/User.js";
import Game from "../models/Game.js";
import GamePlayer from "../models/GamePlayer.js";
import GameSetting from "../models/GameSetting.js";
import Chat from "../models/Chat.js";
import db from "../config/database.js";
import logger from "../config/logger.js";
import { canAccessChallenges } from "../lib/dmAccess.js";
import {
  createGameByBackend,
  joinGameByBackend,
  callContractRead,
  syncBackendPasswordIfMissingOnChain,
} from "../services/tycoonContract.js";
import { ensureGuestContractPlayReady } from "../utils/ensureContractAuth.js";
import { resolveBoardIdForGame } from "../utils/boardVariant.js";
import { invalidateGameByCode, invalidateGameById } from "../utils/gameCache.js";
import { emitGameUpdate } from "../utils/socketHelpers.js";
import { recordEvent } from "../services/analytics.js";

const CHALLENGE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_STARTING_CASH = 1500;
const SYMBOLS = ["hat", "car", "dog", "ship", "boot", "iron", "thimble", "wheelbarrow"];

function userRoom(userId) {
  return `user:${Number(userId)}`;
}

function forbidUnlessChallengePreview(req, res) {
  const username = req.user?.username;
  if (!canAccessChallenges(username)) {
    res.status(403).json({
      success: false,
      message: "Player challenges are in private preview.",
    });
    return false;
  }
  return true;
}

function canUseGuestFlow(user, req) {
  if (!user) return false;
  if (req?.resolvedByAddress) return true;
  return user.is_guest === true || (user.privy_did && String(user.privy_did).trim());
}

function generateChallengeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function pickSymbol(taken = []) {
  const set = new Set((taken || []).map((s) => String(s || "").toLowerCase()));
  for (const s of SYMBOLS) {
    if (!set.has(s)) return s;
  }
  return "hat";
}

function emitChallenge(io, userId, event, payload) {
  if (!io || userId == null) return;
  try {
    io.to(userRoom(userId)).emit(event, payload);
  } catch (err) {
    logger.warn({ err }, "emitChallenge failed");
  }
}

function serializeChallenge(row, extras = {}) {
  if (!row) return null;
  return {
    id: row.id,
    challengerId: row.challenger_id,
    opponentId: row.opponent_id,
    gameId: row.game_id,
    gameCode: row.game_code,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    challengerUsername: row.challenger_username ?? extras.challengerUsername ?? null,
    challengerAddress: row.challenger_address ?? extras.challengerAddress ?? null,
    opponentUsername: row.opponent_username ?? extras.opponentUsername ?? null,
    opponentAddress: row.opponent_address ?? extras.opponentAddress ?? null,
  };
}

async function createPrivateLobbyForChallenger(user, req) {
  const chainForCreate = User.normalizeChain(req.body?.chain || user.chain || "CELO");
  const rPlay = await ensureGuestContractPlayReady(db, user, chainForCreate);
  if (!rPlay.ok) {
    const err = new Error(rPlay.reason || "ONCHAIN_PLAYER_SETUP_FAILED");
    err.code = "ONCHAIN_PLAYER_SETUP_FAILED";
    err.reason = rPlay.reason;
    throw err;
  }

  const contractUser = {
    address: rPlay.address,
    username: rPlay.username,
    password_hash: rPlay.password_hash,
  };

  let code = String(req.body?.code || "").trim().toUpperCase() || generateChallengeCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await Game.findByCode(code);
    if (!existing) break;
    code = generateChallengeCode();
  }

  await syncBackendPasswordIfMissingOnChain(
    contractUser.address,
    contractUser.password_hash,
    contractUser.username,
    DEFAULT_STARTING_CASH,
    chainForCreate,
    { mode: "game", numberOfPlayers: 2 }
  );

  const result = await createGameByBackend(
    contractUser.address,
    contractUser.password_hash,
    contractUser.username,
    "PRIVATE",
    "hat",
    2,
    code,
    DEFAULT_STARTING_CASH,
    0n,
    chainForCreate
  );

  let onChainGameId = result?.gameId;
  if (!onChainGameId && code) {
    try {
      const contractGame = await callContractRead("getGameByCode", [code], chainForCreate);
      const id = contractGame?.id ?? contractGame?.[0];
      if (id != null) onChainGameId = String(id);
    } catch (lookupErr) {
      logger.warn({ err: lookupErr?.message, code }, "challenge getGameByCode fallback failed");
    }
  }

  if (!onChainGameId) {
    const err = new Error("Contract did not return game ID");
    err.code = "CONTRACT_CREATE_FAILED";
    throw err;
  }

  const board_id = await resolveBoardIdForGame(req.body?.board_id);
  const game = await Game.create({
    code,
    mode: "PRIVATE",
    creator_id: user.id,
    next_player_id: user.id,
    number_of_players: 2,
    status: "PENDING",
    is_minipay: !!req.body?.is_minipay,
    is_ai: false,
    duration: req.body?.duration || "30",
    chain: chainForCreate,
    contract_game_id: String(onChainGameId),
    board_id,
  });

  await Chat.ensureForGame(game.id);
  await GameSetting.create({
    game_id: game.id,
    auction: true,
    rent_in_prison: false,
    mortgage: true,
    even_build: true,
    randomize_play_order: true,
    starting_cash: DEFAULT_STARTING_CASH,
  });

  await GamePlayer.create({
    game_id: game.id,
    user_id: user.id,
    address: contractUser.address,
    balance: DEFAULT_STARTING_CASH,
    position: 0,
    turn_order: 1,
    symbol: "hat",
    chance_jail_card: false,
    community_chest_jail_card: false,
  });

  await recordEvent("game_created", {
    entityType: "game",
    entityId: game.id,
    payload: { source: "player_challenge" },
  });

  return game;
}

async function joinOpponentToLobby(user, game, symbol) {
  const chainForJoin = User.normalizeChain(game.chain || "CELO");
  if (!game.contract_game_id) {
    const err = new Error("Game is not ready to join");
    err.code = "GAME_NOT_READY";
    throw err;
  }

  const gameCode = String(game.code || "").trim().toUpperCase();
  const contractGame = await callContractRead("getGameByCode", [gameCode], chainForJoin);
  const onChainGameId = contractGame?.id ?? contractGame?.[0];
  if (onChainGameId == null || onChainGameId === "") {
    const err = new Error("Could not get game id from contract");
    err.code = "CONTRACT_LOOKUP_FAILED";
    throw err;
  }

  const rPlay = await ensureGuestContractPlayReady(db, user, chainForJoin);
  if (!rPlay.ok) {
    const err = new Error(rPlay.reason || "ONCHAIN_PLAYER_SETUP_FAILED");
    err.code = "ONCHAIN_PLAYER_SETUP_FAILED";
    err.reason = rPlay.reason;
    throw err;
  }

  const contractUser = {
    address: rPlay.address,
    username: rPlay.username,
    password_hash: rPlay.password_hash,
  };

  await joinGameByBackend(
    contractUser.address,
    contractUser.password_hash,
    onChainGameId,
    contractUser.username,
    symbol,
    gameCode,
    chainForJoin
  );

  const settings = await GameSetting.findByGameId(game.id);
  await GamePlayer.join({
    address: contractUser.address,
    symbol,
    user_id: user.id,
    game_id: game.id,
    balance: settings?.starting_cash ?? DEFAULT_STARTING_CASH,
    position: 0,
    chance_jail_card: false,
    community_chest_jail_card: false,
    circle: 0,
    rolls: 0,
  });

  // Stay PENDING so both land in the waiting lobby (do not auto-start).
  await invalidateGameByCode(game.code);
  await recordEvent("game_joined", {
    entityType: "game",
    entityId: game.id,
    payload: { user_id: user.id, source: "player_challenge" },
  });
}

const challengeController = {
  /** GET /api/challenges — pending incoming + outgoing */
  async list(req, res) {
    try {
      if (!forbidUnlessChallengePreview(req, res)) return;
      const me = Number(req.userId);
      const [incoming, outgoing] = await Promise.all([
        PlayerChallenge.listIncoming(me),
        PlayerChallenge.listOutgoing(me),
      ]);
      res.json({
        success: true,
        message: "successful",
        data: {
          incoming: incoming.map((r) => serializeChallenge(r)),
          outgoing: outgoing.map((r) => serializeChallenge(r)),
        },
      });
    } catch (error) {
      logger.error({ err: error }, "challenge list error");
      res.status(500).json({ success: false, message: error.message });
    }
  },

  /** POST /api/challenges — { opponentId } create challenge + private 2p lobby */
  async create(req, res) {
    try {
      if (!forbidUnlessChallengePreview(req, res)) return;
      const me = Number(req.userId);
      const user = req.user;
      if (!canUseGuestFlow(user, req)) {
        return res.status(403).json({ success: false, message: "Guest authentication required" });
      }

      const opponentId = Number(req.body?.opponentId ?? req.body?.userId);
      if (!Number.isInteger(opponentId) || opponentId <= 0) {
        return res.status(400).json({ success: false, message: "opponentId required" });
      }
      if (opponentId === me) {
        return res.status(400).json({ success: false, message: "Cannot challenge yourself" });
      }

      const opponent = await User.findById(opponentId);
      if (!opponent?.id) {
        return res.status(404).json({ success: false, message: "Opponent not found" });
      }
      if (!canAccessChallenges(opponent.username)) {
        return res.status(403).json({
          success: false,
          message: "That player is not in the challenge preview.",
        });
      }

      const existing = await PlayerChallenge.findPendingBetween(me, opponentId);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "You already have a pending challenge with this player",
          data: serializeChallenge(existing, {
            challengerUsername: user.username,
            opponentUsername: opponent.username,
          }),
        });
      }

      const game = await createPrivateLobbyForChallenger(user, req);
      const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
      const challenge = await PlayerChallenge.create({
        challenger_id: me,
        opponent_id: opponentId,
        game_id: game.id,
        game_code: game.code,
        status: "pending",
        expires_at: expiresAt,
      });

      const payload = serializeChallenge(challenge, {
        challengerUsername: user.username,
        challengerAddress: user.address,
        opponentUsername: opponent.username,
        opponentAddress: opponent.address,
      });

      const io = req.app.get("io");
      if (io) {
        io.to(game.code).emit("game-created", {
          game: { ...game, players: await GamePlayer.findByGameId(game.id) },
        });
        emitChallenge(io, opponentId, "player-challenge", {
          type: "incoming",
          challenge: payload,
        });
        emitChallenge(io, me, "player-challenge", {
          type: "outgoing",
          challenge: payload,
        });
      }

      return res.status(201).json({
        success: true,
        message: "Challenge sent",
        data: { challenge: payload, game },
      });
    } catch (error) {
      if (error?.code === "ONCHAIN_PLAYER_SETUP_FAILED") {
        return res.status(403).json({
          success: false,
          code: "ONCHAIN_PLAYER_SETUP_FAILED",
          message:
            "Your account could not be prepared to create games on this network. Open Profile once and try again.",
          reason: error.reason || error.message,
        });
      }
      logger.error({ err: error }, "challenge create error");
      return res.status(500).json({ success: false, message: error.message || "Failed to create challenge" });
    }
  },

  /** POST /api/challenges/:id/accept */
  async accept(req, res) {
    try {
      if (!forbidUnlessChallengePreview(req, res)) return;
      const me = Number(req.userId);
      const user = req.user;
      if (!canUseGuestFlow(user, req)) {
        return res.status(403).json({ success: false, message: "Guest authentication required" });
      }

      const id = Number(req.params.id);
      const challenge = await PlayerChallenge.findById(id);
      if (!challenge) {
        return res.status(404).json({ success: false, message: "Challenge not found" });
      }
      if (Number(challenge.opponent_id) !== me) {
        return res.status(403).json({ success: false, message: "Only the challenged player can accept" });
      }
      if (challenge.status !== "pending") {
        return res.status(400).json({ success: false, message: `Challenge is ${challenge.status}` });
      }
      if (challenge.expires_at && new Date(challenge.expires_at).getTime() < Date.now()) {
        await PlayerChallenge.update(id, { status: "expired" });
        return res.status(400).json({ success: false, message: "Challenge expired" });
      }

      const game = await Game.findById(challenge.game_id);
      if (!game || game.status !== "PENDING") {
        await PlayerChallenge.update(id, { status: "cancelled" });
        return res.status(400).json({ success: false, message: "Challenge lobby is no longer open" });
      }

      const players = await GamePlayer.findByGameId(game.id);
      if (players.some((p) => Number(p.user_id) === me)) {
        const updated = await PlayerChallenge.update(id, { status: "accepted" });
        return res.json({
          success: true,
          message: "Already in lobby",
          data: {
            challenge: serializeChallenge(updated),
            gameCode: game.code,
          },
        });
      }
      if (players.length >= game.number_of_players) {
        return res.status(400).json({ success: false, message: "Lobby is full" });
      }

      const symbol = pickSymbol(players.map((p) => p.symbol));
      await joinOpponentToLobby(user, game, symbol);

      const updated = await PlayerChallenge.update(id, { status: "accepted" });
      const challenger = await User.findById(challenge.challenger_id);
      const payload = serializeChallenge(updated, {
        challengerUsername: challenger?.username,
        challengerAddress: challenger?.address,
        opponentUsername: user.username,
        opponentAddress: user.address,
      });

      const io = req.app.get("io");
      if (io) {
        const updatedPlayers = await GamePlayer.findByGameId(game.id);
        emitGameUpdate(io, game.code);
        io.to(game.code).emit("player-joined", {
          player: updatedPlayers[updatedPlayers.length - 1],
          players: updatedPlayers,
          game,
        });
        emitChallenge(io, challenge.challenger_id, "player-challenge", {
          type: "accepted",
          challenge: payload,
        });
        emitChallenge(io, me, "player-challenge", {
          type: "accepted",
          challenge: payload,
        });
      }

      return res.json({
        success: true,
        message: "Challenge accepted",
        data: { challenge: payload, gameCode: game.code },
      });
    } catch (error) {
      if (error?.code === "ONCHAIN_PLAYER_SETUP_FAILED") {
        return res.status(403).json({
          success: false,
          code: "ONCHAIN_PLAYER_SETUP_FAILED",
          message:
            "Your account could not be prepared to join on this network. Open Profile once and try again.",
          reason: error.reason || error.message,
        });
      }
      logger.error({ err: error }, "challenge accept error");
      return res.status(500).json({ success: false, message: error.message || "Failed to accept challenge" });
    }
  },

  /** POST /api/challenges/:id/reject — cancel lobby immediately */
  async reject(req, res) {
    try {
      if (!forbidUnlessChallengePreview(req, res)) return;
      const me = Number(req.userId);
      const id = Number(req.params.id);
      const challenge = await PlayerChallenge.findById(id);
      if (!challenge) {
        return res.status(404).json({ success: false, message: "Challenge not found" });
      }
      if (Number(challenge.opponent_id) !== me && Number(challenge.challenger_id) !== me) {
        return res.status(403).json({ success: false, message: "Not your challenge" });
      }
      if (challenge.status !== "pending") {
        return res.status(400).json({ success: false, message: `Challenge is ${challenge.status}` });
      }

      const status = Number(challenge.opponent_id) === me ? "rejected" : "cancelled";
      const updated = await PlayerChallenge.update(id, { status });

      if (challenge.game_id) {
        const game = await Game.findById(challenge.game_id);
        if (game && !["FINISHED", "CANCELLED"].includes(game.status)) {
          await Game.update(game.id, { status: "CANCELLED" });
          await invalidateGameById(game.id);
          if (game.code) await invalidateGameByCode(game.code);
          const io = req.app.get("io");
          if (io && game.code) {
            emitGameUpdate(io, game.code);
            io.to(game.code).emit("game-ended", { gameCode: game.code, reason: status });
          }
        }
      }

      const payload = serializeChallenge(updated);
      const io = req.app.get("io");
      emitChallenge(io, challenge.challenger_id, "player-challenge", {
        type: status,
        challenge: payload,
      });
      emitChallenge(io, challenge.opponent_id, "player-challenge", {
        type: status,
        challenge: payload,
      });

      return res.json({
        success: true,
        message: status === "rejected" ? "Challenge rejected" : "Challenge cancelled",
        data: { challenge: payload },
      });
    } catch (error) {
      logger.error({ err: error }, "challenge reject error");
      return res.status(500).json({ success: false, message: error.message || "Failed to reject challenge" });
    }
  },
};

export default challengeController;
