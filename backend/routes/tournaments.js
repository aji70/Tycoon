import express from "express";
import * as tournamentController from "../controllers/tournamentController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", tournamentController.list);
router.get("/:id", tournamentController.getById);
router.get("/:id/bracket", tournamentController.getBracket);
router.get("/:id/leaderboard", tournamentController.getLeaderboard);

router.post("/", optionalAuth, tournamentController.create);
router.post("/:id/register", optionalAuth, tournamentController.register);
router.post("/:id/close-registration", tournamentController.closeRegistration);
router.post("/:id/start-round/:roundIndex", tournamentController.startRound);

export default router;
