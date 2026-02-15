import express from "express";
import { guestRegister, guestLogin, me } from "../controllers/guestAuthController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/guest-register", guestRegister);
router.post("/guest-login", guestLogin);
router.get("/me", requireAuth, me);

export default router;
