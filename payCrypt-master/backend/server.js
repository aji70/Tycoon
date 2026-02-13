import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

// Import routes
import authRoutes from "./routes/auth.js";
import balancesRoutes from "./routes/balances.js";
import userRoutes from "./routes/users.js";
import kycRoutes from "./routes/kycs.js";
import transactionRoutes from "./routes/transactions.js";
import tokenRoutes from "./routes/tokens.js";
import chainRoutes from "./routes/chains.js";
import walletRoutes from "./routes/wallets.js";
import bankAccountRoutes from "./routes/bank-accounts.js";
import generalRoutes from "./routes/general.js";

import { SIX_HOURS, updateNgnRate, updateTokenPrices } from "./config/initials.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

// Middleware
app.use(helmet());

// CORS configuration for production
const corsOptions = {
  origin: "*",
  // process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(limiter);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/", generalRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/balances", balancesRoutes);
app.use("/api/users", userRoutes);
app.use("/api/kycs", kycRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/tokens", tokenRoutes);
app.use("/api/chains", chainRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/bank-accounts", bankAccountRoutes);

updateTokenPrices();

updateNgnRate();

setInterval(updateNgnRate, SIX_HOURS * 1000);

setInterval(updateTokenPrices, 60 * 60 * 1000);

// setInterval(listenForDeposits, 2000);

// 404 handler
app.use("*", (req, res) => {
  res.status(400).json({ error: "Page not found" });
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
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

export default app;
