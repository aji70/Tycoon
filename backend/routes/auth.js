import express from "express";
import {
  guestRegister,
  guestLogin,
  privySignin,
  privyCheck,
  me,
  linkWallet,
  unlinkWallet,
  loginByWallet,
  connectEmail,
  verifyEmail,
  loginEmail,
} from "../controllers/guestAuthController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/privy-check", privyCheck);
router.post("/guest-register", guestRegister);
router.post("/guest-login", guestLogin);
router.post("/privy-signin", privySignin);
router.get("/me", requireAuth, me);
router.post("/link-wallet", requireAuth, linkWallet);
router.post("/unlink-wallet", requireAuth, unlinkWallet);
router.post("/login-by-wallet", loginByWallet);
router.post("/connect-email", requireAuth, connectEmail);
router.get("/verify-email", verifyEmail);
router.post("/verify-email", verifyEmail);
router.post("/login-email", loginEmail);

export default router;
