import express from "express";
import { requireAuth, requireAuthOrAddress } from "../middleware/auth.js";
import * as referralController from "../controllers/referralController.js";

const router = express.Router();

router.get("/leaderboard", referralController.getPublicLeaderboard);
router.get("/me", requireAuthOrAddress, referralController.getMe);
router.post("/attach", requireAuthOrAddress, referralController.attach);

export default router;
