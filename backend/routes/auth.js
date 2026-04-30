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
