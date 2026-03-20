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
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
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
import gameTradeRequestRoutes from "./routes/game-trade-requests.js";
import agentRegistryRoutes from "./routes/agent-registry.js";
import agentRegistry from "./services/agentRegistry.js";
import userAgentsRoutes from "./routes/user-agents.js";
import agentApiRoutes from "./routes/agent-api.js";
import waitlistsRoutes from "./routes/waitlists.js";
import chatsRoutes from "./routes/chats.js";
import messagesRoutes from "./routes/messages.js";
import analyticsRoutes from "./routes/analytics.js";
import authRoutes from "./routes/auth.js";
import tournamentsRoutes from "./routes/tournaments.js";
import arenaRoutes from "./routes/arena.js";
import shopAdminRoutes from "./routes/shop-admin.js";

import gamePerkController from "./controllers/gamePerkController.js";
import * as shopController from "./controllers/shopController.js";
import * as dailyClaimController from "./controllers/dailyClaimController.js";
import { requireAuth, optionalAuth } from "./middleware/auth.js";
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
// Lobby presence: socketId -> { userId, username }; used to broadcast "online-users" to lobby room
const lobbyPresenceBySocket = new Map();
const LOBBY_ROOM = "lobby";

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
  const list = [];
  const seen = new Set();
  for (const entry of lobbyPresenceBySocket.values()) {
    const key = entry.userId != null ? `u:${entry.userId}` : (entry.address || `n:${entry.username || "anon"}`);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ userId: entry.userId, username: entry.username || null, address: entry.address || null });
  }
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
    const { userId, username, address } = payload || {};
    const entry = { userId: userId != null ? Number(userId) : null, username: username != null ? String(username).trim() : null, address: address != null ? String(address).trim() : null };
    if (entry.userId || entry.username || entry.address) {
      lobbyPresenceBySocket.set(socket.id, entry);
      socket.join(LOBBY_ROOM);
      broadcastLobbyPresence(io);
    }
  });

  socket.on("disconnect", () => {
    lobbyPresenceBySocket.delete(socket.id);
    broadcastLobbyPresence(io);
    connectionCountByIp.set(ip, Math.max(0, (connectionCountByIp.get(ip) || 0) - 1));
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

  try {
    await redis.get("health");
    health.redis = "up";
  } catch {
    health.redis = "down";
    if (health.db === "up") health.status = "DEGRADED";
  }

  const statusCode = health.status === "OK" ? 200 : 503;
  res.status(statusCode).json(health);
});

// Debug: which env keys are present (values not exposed). Use to verify Railway injects CELO_* etc.
app.get("/api/config/env-check", (_req, res) => {
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
app.get("/api/config/test", async (req, res) => {
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
app.get("/api/config/starknet", async (_req, res) => {
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
app.post("/api/config/call-contract", async (req, res) => {
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
  const list = [];
  const seen = new Set();
  for (const entry of lobbyPresenceBySocket.values()) {
    const key = entry.userId != null ? `u:${entry.userId}` : (entry.address || `n:${entry.username || "anon"}`);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ userId: entry.userId, username: entry.username || null, address: entry.address || null });
  }
  res.json({ success: true, data: { users: list, count: list.length } });
});

// API routes
app.use("/api/auth", authRoutes);
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
app.use("/api/agent-registry", agentRegistryRoutes);
app.use("/api/agents", userAgentsRoutes);
app.use("/api/agent-api", agentApiRoutes);
app.use("/api/waitlist", waitlistsRoutes);
app.use("/api/chats", chatsRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/tournaments", tournamentsRoutes);
app.use("/api/arena", arenaRoutes);
app.use("/api/shop-admin", shopAdminRoutes);

app.post("/api/perks/activate", gamePerkController.activatePerk);
  app.post("/api/perks/teleport", gamePerkController.teleport);
  app.post("/api/perks/exact-roll", gamePerkController.exactRoll);
  app.post("/api/perks/burn-cash", gamePerkController.burnForCash);
  app.post("/api/perks/use-jail-free", gamePerkController.useJailFree);
  app.post("/api/perks/apply-cash", gamePerkController.applyCash);

  app.get("/api/shop/bundles", shopController.listBundles);
  app.post("/api/shop/paystack/initialize", requireAuth, shopController.paystackInitialize);
  app.get("/api/shop/paystack/verify", shopController.paystackVerify);
  app.get("/api/shop/flutterwave/status", shopController.flutterwaveStatus);
  app.post("/api/shop/flutterwave/initialize-test", optionalAuth, shopController.flutterwaveInitializeTest);
  app.post("/api/shop/flutterwave/initialize-perk", requireAuth, shopController.flutterwaveInitializePerk);
  app.post("/api/shop/flutterwave/webhook", shopController.flutterwaveWebhook);
  app.post("/api/shop/flutterwave/initialize", requireAuth, shopController.flutterwaveInitialize);
  app.get("/api/shop/flutterwave/verify", shopController.flutterwaveVerify);
  app.get("/api/rewards/daily-claim/status", requireAuth, dailyClaimController.dailyClaimStatus);
  app.post("/api/rewards/daily-claim", requireAuth, dailyClaimController.dailyClaim);

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

start().catch((err) => {
  logger.error({ err }, "Server failed to start");
  process.exit(1);
});

export { app, server, io };
