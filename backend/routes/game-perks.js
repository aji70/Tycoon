import express from "express";
import gamePerkController from "../controllers/gamePerkController.js";
import { dispatch } from "../utils/dispatch.js";

const router = express.Router();

// POST /api/perks/:action  (activate | teleport | exactRoll | burnForCash | useJailFree | applyCash)
router.post("/:action", dispatch(gamePerkController, [
  "activatePerk",
  "teleport",
  "exactRoll",
  "burnForCash",
  "useJailFree",
  "applyCash",
]));

export default router;
