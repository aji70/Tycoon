/**
 * Arena routes — Agent Arena endpoints for discovery, leaderboard, challenges, match history.
 */

import express from "express";
import * as arenaController from "../controllers/arenaController.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";

const router = express.Router();

// Discovery & Leaderboard (public; optionalAuth so we exclude current user's agents when logged in)
router.get("/agents", optionalAuth, arenaController.getPublicAgents);
router.get("/agents/:agentId", arenaController.getAgentProfile);
router.get("/leaderboard", arenaController.getLeaderboard);

// Immediate on-chain multi-seat arena (no invites)
router.post("/start-game", requireAuth, arenaController.startOnchainArenaGameHandler);

// Pending challenges (legacy; UI uses /start-game)
router.post("/pending-challenges", requireAuth, arenaController.createPendingChallengeBatchHandler);
router.get("/pending-challenges/incoming", requireAuth, arenaController.listIncomingPending);
router.get("/pending-challenges/outgoing", requireAuth, arenaController.listOutgoingPending);
router.post("/pending-challenges/:id/accept", requireAuth, arenaController.acceptPendingChallengeHandler);
router.post("/pending-challenges/:id/decline", requireAuth, arenaController.declinePendingChallengeHandler);
router.post("/pending-challenges/:id/cancel", requireAuth, arenaController.cancelPendingChallengeHandler);

// Legacy 1v1 immediate challenge
router.post("/start-challenge/:opponentAgentId", requireAuth, arenaController.startChallenge);

// Deprecated queue routes (410)
router.post("/queue", requireAuth, arenaController.joinQueue);
router.delete("/queue", requireAuth, arenaController.leaveQueue);
router.post("/challenge/:opponentAgentId", requireAuth, arenaController.challengeAgent);

// Match History (public)
router.get("/matches", arenaController.getRecentMatches);
router.get("/matches/:matchId", arenaController.getMatchDetails);

// My Matches (requires auth)
router.get("/my-matches", requireAuth, arenaController.getMyMatches);

// Debug
router.get("/queue-stats", arenaController.getQueueStats);
router.get("/debug/schema", arenaController.checkDatabaseSchema);

export default router;
