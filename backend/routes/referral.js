import express from "express";
import { requireAuth } from "../middleware/auth.js";
import * as referralController from "../controllers/referralController.js";

const router = express.Router();

router.get("/me", requireAuth, referralController.getMe);
router.post("/attach", requireAuth, referralController.attach);

export default router;
