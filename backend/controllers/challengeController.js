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
  if (
    user.is_guest === true ||
    (user.web3auth_id && String(user.web3auth_id).trim()) ||
    (user.privy_did && String(user.privy_did).trim())
  ) {
    return true;
  }
  // Wallet / JWT sessions (not only guest accounts)
  return Number(user.id) > 0;
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
    stake: row.stake != null ? Number(row.stake) : Number(extras.stake ?? 0) || 0,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    challengerUsername: row.challenger_username ?? extras.challengerUsername ?? null,
    challengerAddress: row.challenger_address ?? extras.challengerAddress ?? null,
    opponentUsername: row.opponent_username ?? extras.opponentUsername ?? null,
    opponentAddress: row.opponent_address ?? extras.opponentAddress ?? null,
  };
}

async function cancelPendingPair(io, userA, userB) {
  const pending = await PlayerChallenge.listPendingBetweenPair(userA, userB);
  for (const row of pending) {
    await PlayerChallenge.update(row.id, { status: "cancelled" });
    if (row.game_id) {
      const g = await Game.findById(row.game_id);
      if (g && !["FINISHED", "CANCELLED"].includes(String(g.status).toUpperCase())) {
        await Game.update(g.id, { status: "CANCELLED" });
        await invalidateGameById(g.id);
        if (g.code) {
          await invalidateGameByCode(g.code);
          if (io) {
            emitGameUpdate(io, g.code);
            io.to(g.code).emit("game-ended", { gameCode: g.code, reason: "cancelled" });
          }
        }
      }
    }
    const payload = serializeChallenge({ ...row, status: "cancelled" });
    emitChallenge(io, row.challenger_id, "player-challenge", {
      type: "cancelled",
      challenge: payload,
    });
    emitChallenge(io, row.opponent_id, "player-challenge", {
      type: "cancelled",
      challenge: payload,
    });
  }
  return pending.length;
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

async function joinOpponentToLobby(user, game, symbol, { stake = 0, playerSignedJoin = false, joinAddress = null } = {}) {
  const chainForJoin = User.normalizeChain(game.chain || "CELO");
  if (!game.contract_game_id) {
    const err = new Error("Game is not ready to join");
    err.code = "GAME_NOT_READY";
    throw err;
  }

  const gameCode = String(game.code || "").trim().toUpperCase();
  const stakeNum = Math.max(0, Number(stake) || 0);

  const rPlay = await ensureGuestContractPlayReady(db, user, chainForJoin);
  if (!rPlay.ok) {
    const err = new Error(rPlay.reason || "ONCHAIN_PLAYER_SETUP_FAILED");
    err.code = "ONCHAIN_PLAYER_SETUP_FAILED";
    err.reason = rPlay.reason;
    throw err;
  }

  const bodyAddr = joinAddress != null ? String(joinAddress).trim() : "";
  const playAddress =
    bodyAddr && /^0x[a-fA-F0-9]{40}$/i.test(bodyAddr) ? bodyAddr : rPlay.address;

  // Challenge accepts always require the opponent to sign joinGame on-chain.
  if (!playerSignedJoin) {
    const err = new Error("Sign joinGame in your wallet to accept this challenge");
    err.code = "JOIN_SIGNATURE_REQUIRED";
    throw err;
  }

  const settings = await GameSetting.findByGameId(game.id);
  await GamePlayer.join({
    address: playAddress,
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
    payload: { user_id: user.id, source: "player_challenge", staked: stakeNum > 0 },
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

  /** POST /api/challenges — { opponentId, gameCode } after challenger signed createGame on-chain */
  async create(req, res) {
    try {
      if (!forbidUnlessChallengePreview(req, res)) return;
      const me = Number(req.userId);
      const user = req.user;
      if (!canUseGuestFlow(user, req)) {
        return res.status(403).json({
          success: false,
          message: "Sign in or connect your wallet to challenge a player",
        });
      }

      const opponentId = Number(req.body?.opponentId ?? req.body?.userId);
      if (!Number.isInteger(opponentId) || opponentId <= 0) {
        return res.status(400).json({ success: false, message: "opponentId required" });
      }
      if (opponentId === me) {
        return res.status(400).json({ success: false, message: "Cannot challenge yourself" });
      }

      const gameCode = String(req.body?.gameCode || req.body?.code || "")
        .trim()
        .toUpperCase();
      if (!gameCode) {
        return res.status(400).json({
          success: false,
          message: "gameCode required — create and sign the game in your wallet first",
        });
      }

      const opponent = await User.findById(opponentId);
      if (!opponent?.id) {
        return res.status(404).json({ success: false, message: "Opponent not found" });
      }

      const getUserPresence = req.app.get("getUserPresence");
      const opponentPresence = typeof getUserPresence === "function" ? getUserPresence(opponentId) : null;
      if (opponentPresence?.status === "game") {
        return res.status(409).json({
          success: false,
          message: "That player is on the board and can't receive challenges right now",
        });
      }

      const stakeNum = Math.max(0, Number(req.body?.stake) || 0);

      const io = req.app.get("io");
      // New challenge replaces any pending challenge between these two players.
      await cancelPendingPair(io, me, opponentId);

      const game = await Game.findByCode(gameCode);
      if (!game) {
        return res.status(404).json({
          success: false,
          message: "Game not found. Sign createGame in your wallet and save it first.",
        });
      }
      if (Number(game.creator_id) !== me) {
        return res.status(403).json({
          success: false,
          message: "Only the wallet that created this game can send the challenge",
        });
      }
      if (String(game.status).toUpperCase() !== "PENDING") {
        return res.status(400).json({ success: false, message: "Game is not open for a challenge" });
      }
      if (Number(game.number_of_players) !== 2) {
        return res.status(400).json({ success: false, message: "Challenge games must be 2 players" });
      }

      // Attach on-chain id if client signed create and passed it with the challenge
      const contractIdRaw = req.body?.contractGameId ?? req.body?.id;
      if (contractIdRaw != null && String(contractIdRaw).trim() && !game.contract_game_id) {
        await Game.update(game.id, { contract_game_id: String(contractIdRaw).trim() });
        game.contract_game_id = String(contractIdRaw).trim();
      }

      const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
      const challenge = await PlayerChallenge.create({
        challenger_id: me,
        opponent_id: opponentId,
        game_id: game.id,
        game_code: game.code,
        status: "pending",
        stake: stakeNum,
        expires_at: expiresAt,
      });

      const payload = serializeChallenge(challenge, {
        challengerUsername: user.username,
        challengerAddress: user.address,
        opponentUsername: opponent.username,
        opponentAddress: opponent.address,
        stake: stakeNum,
      });

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
        return res.status(403).json({
          success: false,
          message: "Sign in or connect your wallet to challenge a player",
        });
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

      const symbolFromBody = String(req.body?.symbol || "").trim().toLowerCase();
      const taken = players.map((p) => p.symbol);
      const symbol =
        symbolFromBody && SYMBOLS.includes(symbolFromBody) && !taken.includes(symbolFromBody)
          ? symbolFromBody
          : pickSymbol(taken);
      const stakeNum = Math.max(0, Number(challenge.stake) || 0);
      const playerSignedJoin = !!(
        req.body?.playerSignedJoin ||
        req.body?.onChainJoined ||
        req.body?.signedJoin
      );
      await joinOpponentToLobby(user, game, symbol, {
        stake: stakeNum,
        playerSignedJoin,
        joinAddress: req.body?.address,
      });

      const updated = await PlayerChallenge.update(id, { status: "accepted" });
      const challenger = await User.findById(challenge.challenger_id);
      const payload = serializeChallenge(updated, {
        challengerUsername: challenger?.username,
        challengerAddress: challenger?.address,
        opponentUsername: user.username,
        opponentAddress: user.address,
      });

      const io = req.app.get("io");
      const updatedPlayers = await GamePlayer.findByGameId(game.id);
      let liveGame = game;

      // Both seats filled — start like a normal multiplayer lobby so turn/roll UI works.
      if (updatedPlayers.length >= game.number_of_players) {
        await Game.update(game.id, { status: "RUNNING", started_at: db.fn.now() });
        liveGame = await Game.findById(game.id);
        const firstUserId = liveGame?.next_player_id || challenge.challenger_id;
        if (firstUserId) {
          await GamePlayer.setTurnStart(game.id, firstUserId);
          if (Number(liveGame?.next_player_id) !== Number(firstUserId)) {
            await Game.update(game.id, { next_player_id: firstUserId });
            liveGame = await Game.findById(game.id);
          }
        }
        await invalidateGameById(game.id);
        await invalidateGameByCode(game.code);
        liveGame = await Game.findById(game.id);
        await recordEvent("game_started", {
          entityType: "game",
          entityId: game.id,
          payload: { source: "player_challenge" },
        });
      }

      if (io) {
        const playersWithTurn = await GamePlayer.findByGameId(game.id);
        emitGameUpdate(io, game.code);
        io.to(game.code).emit("player-joined", {
          player: playersWithTurn[playersWithTurn.length - 1],
          players: playersWithTurn,
          game: liveGame,
        });
        if (String(liveGame?.status).toUpperCase() === "RUNNING") {
          io.to(game.code).emit("game-ready", { game: liveGame, players: playersWithTurn });
          io.to(game.code).emit("game-started", { game: liveGame });
        }
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
        data: { challenge: payload, gameCode: game.code, status: liveGame?.status },
      });
    } catch (error) {
      if (error?.code === "JOIN_SIGNATURE_REQUIRED" || error?.code === "STAKE_JOIN_SIGNATURE_REQUIRED") {
        return res.status(400).json({
          success: false,
          code: error.code,
          message: error.message || "Sign joinGame in your wallet to accept this challenge",
        });
      }
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
