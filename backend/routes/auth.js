import express from "express";
import {
  privySignin,
  privyCheck,
  me,
  registerOnChain,
  linkWallet,
  unlinkWallet,
  createSmartWallet,
  setWithdrawalPin,
  nairaWithdraw,
  smartWalletWithdrawCelo,
  smartWalletWithdrawUsdc,
  loginByWallet,
  connectEmail,
  verifyEmail,
  loginEmail,
} from "../controllers/guestAuthController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/privy-check", privyCheck);
router.post("/privy-signin", privySignin);
router.get("/me", requireAuth, me);
router.post("/register-on-chain", requireAuth, registerOnChain);
router.post("/link-wallet", requireAuth, linkWallet);
router.post("/unlink-wallet", requireAuth, unlinkWallet);
router.post("/create-smart-wallet", requireAuth, createSmartWallet);
router.post("/set-withdrawal-pin", requireAuth, setWithdrawalPin);
router.post("/naira-withdraw", requireAuth, nairaWithdraw);
router.post("/smart-wallet/withdraw-celo", requireAuth, smartWalletWithdrawCelo);
router.post("/smart-wallet/withdraw-usdc", requireAuth, smartWalletWithdrawUsdc);
router.post("/login-by-wallet", loginByWallet);
router.post("/connect-email", requireAuth, connectEmail);
router.get("/verify-email", verifyEmail);
router.post("/verify-email", verifyEmail);
router.post("/login-email", loginEmail);

export default router;
