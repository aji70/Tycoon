import express from "express";
import gamePerkController from "../controllers/gamePerkController.js";
import { requireAuthOrWallet } from "../middleware/auth.js";
import { dispatch } from "../utils/dispatch.js";

const router = express.Router();

// POST /api/perks/:action  (activate | teleport | exactRoll | burnForCash | useJailFree | applyCash)
router.post(
  "/:action",
  requireAuthOrWallet,
  dispatch(
    gamePerkController,
    ["activatePerk", "teleport", "exactRoll", "burnForCash", "useJailFree", "applyCash"],
    {
      // Frontend uses short paths that don't match activatePerk → activate-perk / burnForCash → burn-for-cash
      activate: "activatePerk",
      "burn-cash": "burnForCash",
    }
  )
);

export default router;
