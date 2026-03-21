import express from "express";
import * as tournamentController from "../controllers/tournamentController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { resolveTournament } from "../middleware/resolveTournament.js";
import { requireShopAdminSecret } from "../middleware/shopAdminAuth.js";

const router = express.Router();

router.get("/spectate/:token", tournamentController.getSpectate);
router.get("/", tournamentController.list);
router.get("/:id", optionalAuth, resolveTournament, tournamentController.getById);
router.get("/:id/bracket", optionalAuth, resolveTournament, tournamentController.getBracket);
router.get("/:id/leaderboard", optionalAuth, resolveTournament, tournamentController.getLeaderboard);

router.post("/", optionalAuth, tournamentController.create);
router.post("/:id/register", optionalAuth, resolveTournament, tournamentController.register);
router.post("/:id/auto-fill-agents", requireAuth, resolveTournament, tournamentController.autoFillAgents);
router.post("/:id/close-registration", optionalAuth, resolveTournament, tournamentController.closeRegistration);
router.post("/:id/start-round/:roundIndex", optionalAuth, resolveTournament, tournamentController.startRound);
router.post("/:id/matches/:matchId/start-now", resolveTournament, requireAuth, tournamentController.requestMatchStart);
router.get("/payouts/pending", requireAuth, tournamentController.getUserPendingPayouts);
router.post("/:id/claim-payout/:payoutId", requireAuth, tournamentController.claimPayout);
router.post("/:id/admin-resolve", requireShopAdminSecret, tournamentController.adminResolve);
router.delete("/:id", resolveTournament, tournamentController.remove);

export default router;
