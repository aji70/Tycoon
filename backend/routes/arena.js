/**
 * Arena routes — Agent Arena endpoints for discovery, leaderboard, and matchmaking.
 */

import express from "express";
import * as arenaController from "../controllers/arenaController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Discovery & Leaderboard (public)
router.get("/agents", arenaController.getPublicAgents);
router.get("/agents/:agentId", arenaController.getAgentProfile);
router.get("/leaderboard", arenaController.getLeaderboard);

// Matchmaking Queue (requires auth)
router.post("/queue", requireAuth, arenaController.joinQueue);
router.delete("/queue", requireAuth, arenaController.leaveQueue);
router.post("/challenge/:opponentAgentId", requireAuth, arenaController.challengeAgent);
router.post("/start-challenge/:opponentAgentId", requireAuth, arenaController.startChallenge);

// Match History (public)
router.get("/matches", arenaController.getRecentMatches);
router.get("/matches/:matchId", arenaController.getMatchDetails);

// My Matches (requires auth)
router.get("/my-matches", requireAuth, arenaController.getMyMatches);

// Debug
router.get("/queue-stats", arenaController.getQueueStats);
router.get("/debug/schema", arenaController.checkDatabaseSchema);

export default router;
