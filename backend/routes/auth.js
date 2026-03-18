import express from "express";
import {
  privySignin,
  privyCheck,
  me,
  registerOnChain,
  linkWallet,
  unlinkWallet,
  createSmartWallet,
  recreateSmartWallet,
  setWithdrawalPin,
  setBankDetails,
  nairaWithdraw,
  celoPurchaseInitialize,
  vaultBalances,
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
router.post("/recreate-smart-wallet", requireAuth, recreateSmartWallet);
router.post("/set-withdrawal-pin", requireAuth, setWithdrawalPin);
router.post("/set-bank-details", requireAuth, setBankDetails);
router.post("/naira-withdraw", requireAuth, nairaWithdraw);
router.get("/vault-balances", vaultBalances);
router.post("/celo-purchase/initialize", requireAuth, celoPurchaseInitialize);
router.post("/smart-wallet/withdraw-celo", requireAuth, smartWalletWithdrawCelo);
router.post("/smart-wallet/withdraw-usdc", requireAuth, smartWalletWithdrawUsdc);
router.post("/login-by-wallet", loginByWallet);
router.post("/connect-email", requireAuth, connectEmail);
router.get("/verify-email", verifyEmail);
router.post("/verify-email", verifyEmail);
router.post("/login-email", loginEmail);

export default router;
