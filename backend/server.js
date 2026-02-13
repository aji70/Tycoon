import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { createServer } from "node:http";

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
import waitlistsRoutes from "./routes/waitlists.js";
import chatsRoutes from "./routes/chats.js";
import messagesRoutes from "./routes/messages.js";
import analyticsRoutes from "./routes/analytics.js";

import gamePerkController from "./controllers/gamePerkController.js";
import { connectSocketRedis } from "./config/socketRedis.js";
import logger from "./config/logger.js";
import db from "./config/database.js";
import redis from "./config/redis.js";
import { getCeloConfig } from "./config/celo.js";

dotenv.config();

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

  socket.on("disconnect", () => {
    connectionCountByIp.set(ip, Math.max(0, (connectionCountByIp.get(ip) || 0) - 1));
    socketEventCounts.delete(socket.id);
    logger.info({ socketId: socket.id }, "User disconnected");
  });
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  message: "Too many requests from this IP, please try again later.",
});

app.use(helmet());
app.use(cors());
app.use(limiter);
app.use(express.json({ limit: "1mb" }));
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

// Test endpoint: expose Celo env vars for frontend display (read from backend).
app.get("/api/config/test", (req, res) => {
  const { rpcUrl, contractAddress, privateKey, isConfigured } = getCeloConfig();
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
  res.json({
    CELO_RPC_URL: rpcUrl || null,
    TYCOON_CELO_CONTRACT_ADDRESS: contractAddress || null,
    BACKEND_GAME_CONTROLLER_PRIVATE_KEY: pkDisplay,
    isConfigured: !!isConfigured,
  });
});

// API routes
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
app.use("/api/waitlist", waitlistsRoutes);
app.use("/api/chats", chatsRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/analytics", analyticsRoutes);

app.post("/api/perks/activate", gamePerkController.activatePerk);
app.post("/api/perks/teleport", gamePerkController.teleport);
app.post("/api/perks/exact-roll", gamePerkController.exactRoll);
app.post("/api/perks/burn-cash", gamePerkController.burnForCash);

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
