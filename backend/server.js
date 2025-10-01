import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

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

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(limiter);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API routes
app.use("/api/users", usersRoutes);
app.use("/api/games", gamesRoutes);
app.use("/api/game-settings", gameSettingsRoutes);
app.use("/api/game-players", gamePlayersRoutes);
app.use("/api/game-play-history", gamePlayHistoryRoutes);
app.use("/api/game-trades", gameTradesRoutes);
app.use("/api/game-properties", gamePropertiesRoutes);
app.use("/api/chances", chancesRoutes);
app.use("/api/community-chests", communityChestsRoutes);
app.use("/api/properties", propertiesRoutes);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Page not found" });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error(error.stack);

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  res.status(500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

export default app;
