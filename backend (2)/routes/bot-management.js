/**
 * Bot Management API Routes
 * Endpoints to manage bot account creation, deployment, and game orchestration
 */

import express from "express";
import logger from "../config/logger.js";
import { requireAdmin } from "../middleware/auth.js";
import { generateBotAccounts, registerBotAccounts, getAllBotAccounts } from "../services/botAccountManager.js";
import { startBotGameOrchestrator, stopBotGameOrchestrator, getBotOrchestratorStats } from "../services/botGameOrchestrator.js";

const router = express.Router();

/**
 * POST /api/bot-management/generate
 * Generate 50 new bot accounts with private keys
 * ⚠️ Admin only
 */
router.post("/generate", requireAdmin, async (req, res) => {
  try {
    logger.info("🤖 Generating 50 bot accounts...");

    const bots = await generateBotAccounts();

    res.json({
      success: true,
      message: `Generated ${bots.length} bot accounts`,
      bots: bots.map((b) => ({
        id: b.id,
        username: b.username,
        address: b.address,
        // privateKey not exposed in response for security
      })),
    });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to generate bot accounts");
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/bot-management/register
 * Register all generated bot accounts in database
 * ⚠️ Admin only
 */
router.post("/register", requireAdmin, async (req, res) => {
  try {
    const { bots } = req.body;

    if (!bots || !Array.isArray(bots)) {
      return res.status(400).json({
        success: false,
        error: "Provide array of bot accounts in body",
      });
    }

    logger.info({ botCount: bots.length }, "📝 Registering bot accounts...");

    const results = await registerBotAccounts(bots);

    res.json({
      success: true,
      message: `Registered ${results.registered.length} bots, ${results.failed.length} failed`,
      registered: results.registered,
      failed: results.failed,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to register bot accounts");
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/bot-management/list
 * List all bot accounts
 * ⚠️ Admin only
 */
router.get("/list", requireAdmin, async (req, res) => {
  try {
    const bots = await getAllBotAccounts();

    res.json({
      success: true,
      count: bots.length,
      bots,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to list bot accounts");
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/bot-management/start-orchestrator
 * Start the bot game orchestrator
 * Continuously creates games between random bot pairs
 * ⚠️ Admin only
 */
router.post("/start-orchestrator", requireAdmin, (req, res) => {
  try {
    const io = req.app.get("io");

    logger.info("🎮 Starting bot game orchestrator...");

    startBotGameOrchestrator(io);

    res.json({
      success: true,
      message: "Bot game orchestrator started",
      message2: "Check logs for continuous game creation",
    });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to start orchestrator");
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/bot-management/stop-orchestrator
 * Stop the bot game orchestrator
 * ⚠️ Admin only
 */
router.post("/stop-orchestrator", requireAdmin, (req, res) => {
  try {
    logger.info("⏹️  Stopping bot game orchestrator...");

    stopBotGameOrchestrator();

    res.json({
      success: true,
      message: "Bot game orchestrator stopped",
    });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to stop orchestrator");
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/bot-management/stats
 * Get current orchestrator stats
 * ⚠️ Admin only
 */
router.get("/stats", requireAdmin, (req, res) => {
  try {
    const stats = getBotOrchestratorStats();

    res.json({
      success: true,
      stats,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to get orchestrator stats");
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
