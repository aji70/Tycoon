import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { createServer } from "node:http";
import * as Sentry from "@sentry/node";

dotenv.config();

if (process.env.SENTRY_DSN) {
  const sampleRate = process.env.SENTRY_TRACE_SAMPLE_RATE
    ? Number(process.env.SENTRY_TRACE_SAMPLE_RATE)
    : (process.env.NODE_ENV === "production" ? 0.1 : 1.0);
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: Math.max(0, Math.min(1, sampleRate)),
  });
}

// Import routes
import usersRoutes from "./routes/users.js";
import gamesRoutes from "./routes/games.js";
import gameSettingsRoutes from "./routes/game-settings.js";
import gamePlayersRoutes from "./routes/game-players.js";
import gamePlayHistoryRoutes from "./routes/game-play-history.js";
import gameTradesRoutes from "./routes/game-trades.js";
import gamePropertiesRoutes from "./routes/game-properties.js";
import chancesRoutes from "./routes/chances.js";
import communityChestsRoutes from "./routes/community-chests.js";
import propertiesRoutes from "./routes/properties.js";
import boardVariantsRoutes from "./routes/board-variants.js";
import gameTradeRequestRoutes from "./routes/game-trade-requests.js";
import agentRegistryRoutes from "./routes/agent-registry.js";
import agentRegistry from "./services/agentRegistry.js";
import userAgentsRoutes from "./routes/user-agents.js";
import agentApiRoutes from "./routes/agent-api.js";
import waitlistsRoutes from "./routes/waitlists.js";
import chatsRoutes from "./routes/chats.js";
import messagesRoutes from "./routes/messages.js";
import dmsRoutes from "./routes/dms.js";
import analyticsRoutes from "./routes/analytics.js";
import authRoutes from "./routes/auth.js";
import tournamentsRoutes from "./routes/tournaments.js";
import arenaRoutes from "./routes/arena.js";
import shopAdminRoutes from "./routes/shop-admin.js";
import adminDashboardRoutes from "./routes/admin-dashboard.js";
import referralRoutes from "./routes/referral.js";
import questsRoutes from "./routes/quests.js";
import publicStatsRoutes from "./routes/public-stats.js";
import { requireAdminIpAllowlist, adminApiRateLimiter } from "./middleware/adminDashboardGate.js";

import gamePerkRoutes from "./routes/game-perks.js";
import * as shopController from "./controllers/shopController.js";
import * as dailyClaimController from "./controllers/dailyClaimController.js";
import { requireAuth, requireAuthOrWallet, optionalAuth } from "./middleware/auth.js";
import { blockApiWhenMaintenance } from "./middleware/maintenanceMode.js";
import { connectSocketRedis } from "./config/socketRedis.js";
import logger from "./config/logger.js";
import db from "./config/database.js";
import redis from "./config/redis.js";
import { getChainConfig } from "./config/chains.js";
import { testContractConnection, callContractRead, callContractWrite } from "./services/tycoonContract.js";
import { getStarknetConfig } from "./config/starknet.js";
import { isStarknetConfigured, testStarknetConnection } from "./services/starknetContract.js";
import { startAgentGameRunner } from "./services/agentGameRunner.js";
import { startAgentTournamentRunner } from "./services/agentTournamentRunner.js";
import { startTimedGameFinishPoller } from "./services/timedGameFinishPoller.js";
import { startLeaderboardSnapshotScheduler } from "./services/leaderboardSnapshotScheduler.js";

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

// Step 7: Connection limits (per-IP) and socket event rate limiting
const CONNECTIONS_PER_IP = 5;
const EVENTS_PER_SOCKET_PER_MINUTE = 60;
const connectionCountByIp = new Map();
const socketEventCounts = new Map(); // socketId -> { count, resetAt }
// Lobby presence: socketId -> { userId, username, address, status, gameCode }
const lobbyPresenceBySocket = new Map();
const LOBBY_ROOM = "lobby";

function presenceRank(status) {
  if (status === "game") return 3;
  if (status === "waiting") return 2;
  return 1;
}

function buildOnlineUsersList() {
  const byKey = new Map();
  for (const entry of lobbyPresenceBySocket.values()) {
    const key =
      entry.userId != null ? `u:${entry.userId}` : entry.address || `n:${entry.username || "anon"}`;
    const prev = byKey.get(key);
    if (!prev || presenceRank(entry.status) >= presenceRank(prev.status)) {
      byKey.set(key, {
        userId: entry.userId,
        username: entry.username || null,
        address: entry.address || null,
        status: entry.status === "game" || entry.status === "waiting" ? entry.status : "lobby",
        gameCode: entry.gameCode || null,
      });
    }
  }
  return Array.from(byKey.values());
}

function getClientIp(socket) {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return socket.handshake.address || socket.conn?.remoteAddress || "unknown";
}

function checkSocketEventRate(socket) {
  const now = Date.now();
  const oneMin = 60 * 1000;
  let entry = socketEventCounts.get(socket.id);
  if (!entry) {
    entry = { count: 0, resetAt: now + oneMin };
    socketEventCounts.set(socket.id, entry);
  }
  if (now >= entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + oneMin;
  }
  entry.count += 1;
  if (entry.count > EVENTS_PER_SOCKET_PER_MINUTE) {
    return false;
  }
  return true;
}

function broadcastLobbyPresence(socketIo) {
  const list = buildOnlineUsersList();
  socketIo.to(LOBBY_ROOM).emit("online-users", { users: list, count: list.length });
}

io.on("connection", (socket) => {
  const ip = getClientIp(socket);
  const current = connectionCountByIp.get(ip) || 0;
  if (current >= CONNECTIONS_PER_IP) {
    logger.warn({ ip, socketId: socket.id }, "Connection rejected: per-IP limit");
    socket.disconnect(true);
    return;
  }
  connectionCountByIp.set(ip, current + 1);
  logger.info({ socketId: socket.id, ip }, "User connected");

  socket.on("join-game-room", (gameCode) => {
    if (!checkSocketEventRate(socket)) {
      socket.emit("error", { message: "Too many actions; slow down." });
      return;
    }
    socket.join(gameCode);
    logger.debug({ socketId: socket.id, gameCode }, "User joined room");
  });

  socket.on("leave-game-room", (gameCode) => {
    if (!checkSocketEventRate(socket)) {
      socket.emit("error", { message: "Too many actions; slow down." });
      return;
    }
    socket.leave(gameCode);
    logger.debug({ socketId: socket.id, gameCode }, "User left room");
  });

  // Register presence in global lobby (for "everyone online" and general chat)
  socket.on("register-presence", (payload) => {
    if (!checkSocketEventRate(socket)) {
      socket.emit("error", { message: "Too many actions; slow down." });
      return;
    }
    const { userId, username, address, status, gameCode } = payload || {};
    const normalizedStatus =
      status === "game" || status === "waiting" || status === "lobby" ? status : "lobby";
    const entry = {
      userId: userId != null ? Number(userId) : null,
      username: username != null ? String(username).trim() : null,
      address: address != null ? String(address).trim() : null,
      status: normalizedStatus,
      gameCode:
        gameCode != null && String(gameCode).trim()
          ? String(gameCode).trim().toUpperCase()
          : null,
    };
    if (entry.userId || entry.username || entry.address) {
      lobbyPresenceBySocket.set(socket.id, entry);
      socket.join(LOBBY_ROOM);
      if (entry.userId != null && Number.isFinite(entry.userId)) {
        socket.join(`user:${entry.userId}`);
      }
      broadcastLobbyPresence(io);
      // Immediate ack to the registrant so they don't wait on room fan-out / missed broadcast
      const list = buildOnlineUsersList();
      socket.emit("online-users", { users: list, count: list.length });
    }
  });

  socket.on("disconnect", () => {
    lobbyPresenceBySocket.delete(socket.id);
    broadcastLobbyPresence(io);
    const remaining = Math.max(0, (connectionCountByIp.get(ip) || 0) - 1);
    if (remaining === 0) {
      connectionCountByIp.delete(ip); // don't accumulate one entry per unique IP forever
    } else {
      connectionCountByIp.set(ip, remaining);
    }
    socketEventCounts.delete(socket.id);
    logger.info({ socketId: socket.id }, "User disconnected");
  });
});

// Rate limiting: allow enough headroom for active game sessions (AI turns, sync, trades).
// Frontend also throttles fetchUpdatedGame and batches AI actions to reduce bursts.
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 500;
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: RATE_LIMIT_MAX,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(cors());
app.use(limiter);

// Paystack webhook must receive raw body for signature verification (before express.json)
app.post(
  "/api/shop/paystack/webhook",
  express.raw({ type: "application/json" }),
  shopController.paystackWebhook
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(blockApiWhenMaintenance);

// Step 10: Health check (DB + Redis)
app.get("/health", async (req, res) => {
  const health = {
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    db: "unknown",
    redis: "unknown",
  };

  try {
    await db.raw("SELECT 1");
    health.db = "up";
  } catch (err) {
    health.db = "down";
    health.status = "DEGRADED";
  }

  if (redis.isReady) {
    health.redis = "up";
  } else {
    health.redis = "down";
    if (health.db === "up") health.status = "DEGRADED";
  }

  const statusCode = health.status === "OK" ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * Config/debug endpoints guard.
 * These expose environment layout and (worst of all) contract writes signed with the
 * backend controller key. Open in development; in production they require
 * CONFIG_DEBUG_KEY to be set and passed as the x-config-debug-key header,
 * otherwise they respond 404 as if they don't exist.
 */
function requireConfigDebugAccess(req, res, next) {
  if (process.env.NODE_ENV !== "production") return next();
  const expected = process.env.CONFIG_DEBUG_KEY;
  if (expected && req.headers["x-config-debug-key"] === expected) return next();
  return res.status(404).json({ success: false, error: "Endpoint not found" });
}

// Debug: which env keys are present (values not exposed). Use to verify Railway injects CELO_* etc.
app.get("/api/config/env-check", requireConfigDebugAccess, (_req, res) => {
  const keys = [
    "CELO_RPC_URL",
    "TYCOON_CELO_CONTRACT_ADDRESS",
    "BACKEND_GAME_CONTROLLER_PRIVATE_KEY",
    "BACKEND_GAME_CONTROLLER_CELO_PRIVATE_KEY",
    "POLYGON_RPC_URL",
    "TYCOON_POLYGON_CONTRACT_ADDRESS",
    "BACKEND_GAME_CONTROLLER_POLYGON_PRIVATE_KEY",
    "BASE_RPC_URL",
    "TYCOON_BASE_CONTRACT_ADDRESS",
    "PRIVY_APP_ID",
    "PRIVY_APP_SECRET",
    "PRIVY_JWT_VERIFICATION_KEY",
  ];
  const present = {};
  keys.forEach((k) => {
    present[k] = typeof process.env[k] === "string" && process.env[k].trim().length > 0;
  });
  const payload = { envKeysPresent: present };
  // In development, show masked PRIVY_APP_ID so you can confirm it matches frontend NEXT_PUBLIC_PRIVY_APP_ID
  if (process.env.NODE_ENV !== "production" && present.PRIVY_APP_ID) {
    const id = process.env.PRIVY_APP_ID;
    payload.privyAppIdMasked = id.length > 8 ? `${id.slice(0, 4)}...${id.slice(-4)}` : "***";
  }
  res.json(payload);
});

// Test endpoint: expose chain env vars for frontend config-test. ?chain=Polygon|Celo|Base (default Polygon).
app.get("/api/config/test", requireConfigDebugAccess, async (req, res) => {
  const chain = (req.query.chain || "POLYGON").toString().toUpperCase();
  const norm = chain === "CELO" ? "CELO" : chain === "POLYGON" ? "POLYGON" : "BASE";
  const { rpcUrl, contractAddress, privateKey, isConfigured } = getChainConfig(norm);
  const fullPk = req.query.full === "1" && process.env.NODE_ENV === "development";
  let pkDisplay = null;
  if (privateKey) {
    if (fullPk) {
      pkDisplay = privateKey;
    } else {
      const len = privateKey.length;
      pkDisplay = len > 12 ? `${privateKey.slice(0, 6)}...${privateKey.slice(-4)}` : "***";
    }
  }
  const result = {
    chain: norm,
    isConfigured: !!isConfigured,
    BACKEND_GAME_CONTROLLER_PRIVATE_KEY: pkDisplay,
  };
  if (norm === "CELO") {
    result.CELO_RPC_URL = rpcUrl || null;
    result.TYCOON_CELO_CONTRACT_ADDRESS = contractAddress || null;
  } else if (norm === "POLYGON") {
    result.POLYGON_RPC_URL = rpcUrl || null;
    result.TYCOON_POLYGON_CONTRACT_ADDRESS = contractAddress || null;
  } else {
    result.BASE_RPC_URL = rpcUrl || null;
    result.TYCOON_BASE_CONTRACT_ADDRESS = contractAddress || null;
  }
  if (req.query.test_connection === "1") {
    result.connectionTest = await testContractConnection(norm);
  }
  res.json(result);
});

// Starknet (Cairo/Dojo) config and connection test
app.get("/api/config/starknet", requireConfigDebugAccess, async (_req, res) => {
  const { rpcUrl, gameAddress, playerAddress, isConfigured } = getStarknetConfig();
  const result = {
    isConfigured: !!isConfigured,
    STARKNET_RPC_URL: rpcUrl || null,
    STARKNET_DOJO_GAME_ADDRESS: gameAddress || null,
    STARKNET_DOJO_PLAYER_ADDRESS: playerAddress || null,
  };
  if (_req.query.test_connection === "1") {
    result.connectionTest = await testStarknetConnection();
  }
  res.json(result);
});

// Call contract read/write (for config-test). Optional body.chain (CELO, POLYGON, BASE).
app.post("/api/config/call-contract", requireConfigDebugAccess, async (req, res) => {
  try {
    const { fn, params = [], write = false, chain = "CELO" } = req.body || {};
    if (!fn || typeof fn !== "string") {
      return res.status(400).json({ success: false, error: "fn (string) required" });
    }
    const paramArr = Array.isArray(params) ? params : [params];
    if (write) {
      const result = await callContractWrite(fn, paramArr, chain);
      res.json({ success: true, result });
    } else {
      const result = await callContractRead(fn, paramArr, chain);
      res.json({ success: true, result });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Online users (from socket lobby presence)
app.get("/api/users/online", (_req, res) => {
  const list = buildOnlineUsersList();
  res.json({ success: true, data: { users: list, count: list.length } });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/public", publicStatsRoutes);
app.use("/api/referral", referralRoutes);
app.use("/api/quests", questsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/games", gamesRoutes);
app.use("/api/game-settings", gameSettingsRoutes);
app.use("/api/game-players", gamePlayersRoutes);
app.use("/api/game-play-history", gamePlayHistoryRoutes);
app.use("/api/game-trades", gameTradesRoutes);
app.use("/api/game-trade-requests", gameTradeRequestRoutes);
app.use("/api/game-properties", gamePropertiesRoutes);
app.use("/api/chances", chancesRoutes);
app.use("/api/community-chests", communityChestsRoutes);
app.use("/api/properties", propertiesRoutes);
app.use("/api/board-variants", boardVariantsRoutes);
app.use("/api/agent-registry", agentRegistryRoutes);
app.use("/api/agents", userAgentsRoutes);
app.use("/api/agent-api", agentApiRoutes);
app.use("/api/waitlist", waitlistsRoutes);
app.use("/api/chats", chatsRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/dms", dmsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/tournaments", tournamentsRoutes);
app.use("/api/arena", arenaRoutes);
app.use("/api/shop-admin", shopAdminRoutes);
app.use("/api/admin", requireAdminIpAllowlist, adminApiRateLimiter, adminDashboardRoutes);

app.use("/api/perks", gamePerkRoutes);

  app.get("/api/shop/bundles", shopController.listBundles);
  app.post("/api/shop/paystack/initialize", requireAuth, shopController.paystackInitialize);
  app.get("/api/shop/paystack/verify", shopController.paystackVerify);
  app.get("/api/shop/flutterwave/status", shopController.flutterwaveStatus);
  app.post("/api/shop/flutterwave/initialize-test", optionalAuth, shopController.flutterwaveInitializeTest);
  app.post("/api/shop/flutterwave/initialize-perk", requireAuthOrWallet, shopController.flutterwaveInitializePerk);
  app.post("/api/shop/flutterwave/webhook", shopController.flutterwaveWebhook);
  app.post("/api/shop/flutterwave/initialize", requireAuthOrWallet, shopController.flutterwaveInitialize);
  app.get("/api/shop/flutterwave/verify", shopController.flutterwaveVerify);
  app.get("/api/rewards/daily-claim/status", requireAuthOrWallet, dailyClaimController.dailyClaimStatus);
  app.post("/api/rewards/daily-claim", requireAuthOrWallet, dailyClaimController.dailyClaim);

  // Agent discoverability: .well-known/skill → agent-api skill (markdown)
  app.get("/.well-known/skill", (_req, res) => res.redirect(302, "/api/agent-api/skill"));
  app.get("/.well-known/skill.md", (_req, res) => res.redirect(302, "/api/agent-api/skill"));

if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.use("*", (req, res) => {
  res.status(404).json({ success: false, error: "Endpoint not found" });
});

app.use((error, req, res, next) => {
  logger.error({ err: error, stack: error.stack }, "Unhandled error");

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, error: "Invalid JSON" });
  }

  res.status(500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message,
  });
});

async function start() {
  // Rehydrate agent slot assignments from DB (survives restarts)
  try {
    await agentRegistry.rehydrateFromDb();
  } catch (err) {
    logger.warn({ err: err.message }, "Agent registry rehydrate skipped");
  }
  // Auto-register internal agent slots (TYCOON_INTERNAL_AGENT_SLOTS=2,3,4,5,6,7,8)
  try {
    await agentRegistry.autoRegisterInternalAgentSlots();
  } catch (err) {
    logger.warn({ err: err.message }, "Internal agent auto-register skipped");
  }

  // Server-autonomous agent games (Agent vs Agent / Agent vs AI)
  try {
    startAgentGameRunner();
  } catch (err) {
    logger.warn({ err: err?.message }, "Agent game runner failed to start");
  }

  // Server-autonomous agent tournaments (auto-register + auto-start)
  try {
    startAgentTournamentRunner();
  } catch (err) {
    logger.warn({ err: err?.message }, "Agent tournament runner failed to start");
  }

  try {
    startLeaderboardSnapshotScheduler();
  } catch (err) {
    logger.warn({ err: err?.message }, "Leaderboard snapshot scheduler failed to start");
  }

  try {
    startTimedGameFinishPoller(io);
  } catch (err) {
    logger.warn({ err: err?.message }, "Timed game finish poller failed to start");
  }

  try {
    const { startTournamentPayoutRecoveryPoller } = await import("./services/tournamentPayoutRecoveryPoller.js");
    startTournamentPayoutRecoveryPoller();
  } catch (err) {
    logger.warn({ err: err?.message }, "Tournament payout recovery poller failed to start");
  }

  // Step 5: Socket.io Redis adapter (when Redis is available)
  try {
    const adapter = await connectSocketRedis();
    if (adapter) {
      io.adapter(adapter);
      logger.info("Socket.io Redis adapter attached");
    }
  } catch (err) {
    logger.warn({ err: err.message }, "Socket.io Redis adapter skipped");
  }

  server.listen(PORT, () => {
    logger.info({
      port: PORT,
      env: process.env.NODE_ENV,
      health: `http://localhost:${PORT}/health`,
    }, "Server running");
  });
}

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  logger.error("JWT_SECRET is not set in production — auth tokens are signed with a known default. Set JWT_SECRET now.");
}

// Graceful shutdown: Railway sends SIGTERM on redeploys. Stop accepting new
// connections, let in-flight requests finish, then release DB/Redis resources.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");

  const forceExit = setTimeout(() => {
    logger.warn("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    io.close();
    await new Promise((resolve) => server.close(resolve));
    await Promise.allSettled([db.destroy(), redis.quit()]);
    logger.info("Shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Shutdown error");
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});

start().catch((err) => {
  logger.error({ err }, "Server failed to start");
  process.exit(1);
});

export { app, server, io };
