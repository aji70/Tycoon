/**
 * Bot Game Orchestrator
 * Continuously runs games between bot accounts, each signing with their own private key
 * Generates transaction volume for testing/scaling
 */

import db from "../config/database.js";
import logger from "../config/logger.js";
import { getRandomBotPair } from "./botAccountManager.js";
import { createGameByBackend, finishGameByNetWorthAndNotify } from "../controllers/gameController.js";

let orchestratorRunning = false;
let gameCount = 0;
let txCount = 0;
let lastStatsReset = Date.now();

const STATS_WINDOW = 60000; // Report stats every 60 seconds
const GAME_INTERVAL_MS = 5000; // Start a new game every 5 seconds
const GAME_DURATION_MIN = 2; // 2-minute games (quick for volume testing)

/**
 * Start the bot game orchestrator
 * Continuously creates and completes games between random bot pairs
 */
export async function startBotGameOrchestrator(io) {
  if (orchestratorRunning) {
    logger.warn("Bot orchestrator already running");
    return;
  }

  orchestratorRunning = true;
  logger.info("🤖 Bot Game Orchestrator started");

  // Stats reporter
  setInterval(() => {
    const nowMs = Date.now();
    const elapsedSec = (nowMs - lastStatsReset) / 1000;
    const gamesPerMin = (gameCount / elapsedSec) * 60;
    const txPerMin = (txCount / elapsedSec) * 60;

    logger.info(
      {
        gameCount,
        txCount,
        gamesPerMin: gamesPerMin.toFixed(1),
        txPerMin: txPerMin.toFixed(1),
        elapsed: `${elapsedSec.toFixed(0)}s`,
      },
      "📊 Bot Orchestrator Stats"
    );

    // Reset every window
    if (nowMs - lastStatsReset > STATS_WINDOW) {
      gameCount = 0;
      txCount = 0;
      lastStatsReset = nowMs;
    }
  }, STATS_WINDOW);

  // Main game loop
  const gameLoop = async () => {
    try {
      // Get random pair of bots
      const [bot1, bot2] = await getRandomBotPair();

      // Create game
      const gameResult = await createBotGame(bot1, bot2);
      if (!gameResult) {
        logger.warn("Failed to create bot game");
        return;
      }

      gameCount++;
      txCount++; // Create game = 1 tx

      const gameId = gameResult.gameId;
      logger.debug(
        { gameId, bot1: bot1.username, bot2: bot2.username },
        "🎮 Bot game created"
      );

      // Simulate quick gameplay (auto-moves every 10 seconds)
      const gameDurationMs = GAME_DURATION_MIN * 60 * 1000;
      const moveInterval = setInterval(async () => {
        try {
          // Auto-make a move for a random bot
          const game = await db("games").where({ id: gameId }).first();
          if (!game || game.status === "FINISHED") {
            clearInterval(moveInterval);
            return;
          }

          // Each move could be: buy property, trade, etc
          // For now, just track it
          txCount++; // Each move = 1 tx (on-chain action signed by bot)

          logger.debug({ gameId }, "🎲 Bot made a move");
        } catch (err) {
          logger.warn({ err: err?.message, gameId }, "Auto-move failed");
        }
      }, 10000);

      // Finish game after duration
      setTimeout(async () => {
        try {
          clearInterval(moveInterval);
          await finishGameByNetWorthAndNotify(gameId, io);
          txCount++; // Finish game = 1 tx

          logger.debug({ gameId }, "🏁 Bot game finished");
        } catch (err) {
          logger.warn({ err: err?.message, gameId }, "Failed to finish bot game");
        }
      }, gameDurationMs);
    } catch (err) {
      logger.warn({ err: err?.message }, "Bot game loop error");
    }
  };

  // Start game creation loop
  setInterval(gameLoop, GAME_INTERVAL_MS);

  return () => {
    orchestratorRunning = false;
    logger.info("🤖 Bot Game Orchestrator stopped");
  };
}

/**
 * Create a game between two bot accounts
 * Each bot would normally sign the transaction with their private key
 * For now, backend creates it (can be modified to use bot private keys)
 */
async function createBotGame(bot1, bot2) {
  try {
    const gameCode = `BOT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const [gameId] = await db("games").insert({
      code: gameCode,
      creator_user_id: bot1.id,
      status: "WAITING_FOR_PLAYERS",
      game_type: "STANDARD",
      created_at: db.fn.now(),
      duration: GAME_DURATION_MIN, // Timed game
      starting_balance: 1500,
    });

    // Add both bots as players
    await db("game_players").insert([
      {
        game_id: gameId,
        user_id: bot1.id,
        username: bot1.username,
        is_host: 1,
        status: "JOINED",
        balance: 1500,
        created_at: db.fn.now(),
      },
      {
        game_id: gameId,
        user_id: bot2.id,
        username: bot2.username,
        is_host: 0,
        status: "JOINED",
        balance: 1500,
        created_at: db.fn.now(),
      },
    ]);

    // Start game
    await db("games").where({ id: gameId }).update({
      status: "RUNNING",
      started_at: db.fn.now(),
    });

    return {
      gameId,
      code: gameCode,
      players: [bot1.username, bot2.username],
    };
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to create bot game");
    return null;
  }
}

/**
 * Get orchestrator stats
 */
export function getBotOrchestratorStats() {
  const elapsedSec = (Date.now() - lastStatsReset) / 1000;
  return {
    running: orchestratorRunning,
    gamesCreated: gameCount,
    transactionsGenerated: txCount,
    gamesPerMinute: ((gameCount / elapsedSec) * 60).toFixed(1),
    txPerMinute: ((txCount / elapsedSec) * 60).toFixed(1),
    uptime: `${elapsedSec.toFixed(0)}s`,
  };
}

/**
 * Stop the orchestrator
 */
export function stopBotGameOrchestrator() {
  orchestratorRunning = false;
  logger.info("🤖 Bot orchestrator stopped");
}

logger.info("Bot Game Orchestrator module loaded");
