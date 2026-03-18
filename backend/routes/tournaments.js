import express from "express";
import * as tournamentController from "../controllers/tournamentController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { resolveTournament } from "../middleware/resolveTournament.js";

const router = express.Router();

router.get("/", tournamentController.list);
router.get("/:id", resolveTournament, tournamentController.getById);
router.get("/:id/bracket", resolveTournament, tournamentController.getBracket);
router.get("/:id/leaderboard", resolveTournament, tournamentController.getLeaderboard);

router.post("/", optionalAuth, tournamentController.create);
router.post("/:id/register", resolveTournament, optionalAuth, tournamentController.register);
router.post("/:id/auto-fill-agents", resolveTournament, requireAuth, tournamentController.autoFillAgents);
router.post("/:id/close-registration", resolveTournament, tournamentController.closeRegistration);
router.post("/:id/start-round/:roundIndex", resolveTournament, tournamentController.startRound);
router.post("/:id/matches/:matchId/start-now", resolveTournament, requireAuth, tournamentController.requestMatchStart);
router.delete("/:id", resolveTournament, tournamentController.remove);

export default router;
