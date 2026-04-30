import express from "express";
import * as guestAuthController from "../controllers/guestAuthController.js";
import { dispatch } from "../utils/dispatch.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/privy-check", guestAuthController.privyCheck);
router.post("/privy-signin", guestAuthController.privySignin);
router.get("/me", requireAuth, guestAuthController.me);
router.get("/vault-balances", guestAuthController.vaultBalances);
router.get("/verify-email", guestAuthController.verifyEmail);
router.post("/verify-email", guestAuthController.verifyEmail);
router.post("/login-by-wallet", guestAuthController.loginByWallet);
router.post("/login-email", guestAuthController.loginEmail);

// Backward-compatible aliases for multi-segment smart-wallet routes used by some frontend pages.
router.post("/smart-wallet/withdraw-celo", requireAuth, guestAuthController.smartWalletWithdrawCelo);
router.post("/smart-wallet/withdraw-usdc", requireAuth, guestAuthController.smartWalletWithdrawUsdc);
router.post("/smart-wallet/buy-collectible", requireAuth, guestAuthController.smartWalletBuyCollectible);
router.post("/smart-wallet/buy-bundle", requireAuth, guestAuthController.smartWalletBuyBundle);
router.post("/smart-wallet/burn-collectible", requireAuth, guestAuthController.smartWalletBurnCollectible);

// POST /api/auth/:action  (all require auth)
router.post("/:action", requireAuth, dispatch(guestAuthController, [
  "registerOnChain",
  "linkWallet",
  "unlinkWallet",
  "createSmartWallet",
  "recreateSmartWallet",
  "redeemVoucher",
  "setWithdrawalPin",
  "setBankDetails",
  "nairaWithdraw",
  "celoPurchaseInitialize",
  "smartWalletWithdrawCelo",
  "smartWalletWithdrawUsdc",
  "smartWalletBuyCollectible",
  "smartWalletBuyBundle",
  "smartWalletBurnCollectible",
  "connectEmail",
]));

export default router;
