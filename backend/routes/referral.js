import express from "express";
import { requireAuthOrWallet } from "../middleware/auth.js";
import * as referralController from "../controllers/referralController.js";

const router = express.Router();

router.get("/leaderboard", referralController.getPublicLeaderboard);
router.get("/me", requireAuthOrWallet, referralController.getMe);
router.post("/attach", requireAuthOrWallet, referralController.attach);

export default router;
