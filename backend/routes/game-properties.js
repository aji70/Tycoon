import { Router } from "express";
import gamePropertyController from "../controllers/gamePropertyController.js";
import { dispatch } from "../utils/dispatch.js";

const router = Router();

// POST /api/game-properties/:action  (buy | sell | development | downgrade | mortgage | unmortgage)
router.post("/:action", dispatch(gamePropertyController, [
  "buy",
  "sell",
  "development",
  "downgrade",
  "mortgage",
  "unmortgage",
]));

// CRUD
router.post("/", gamePropertyController.create);
router.get("/", gamePropertyController.findAll);
router.get("/:id", gamePropertyController.findById);
router.put("/:id", gamePropertyController.update);
router.delete("/:id", gamePropertyController.remove);

// Lookups
router.get("/game/:gameId", gamePropertyController.findByGame);
router.get("/player/:playerId", gamePropertyController.findByPlayer);

export default router;
