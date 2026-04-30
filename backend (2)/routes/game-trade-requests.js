import express from "express";
import { GameTradeRequestController } from "../controllers/gameTradeRequestController.js";
import { dispatch } from "../utils/dispatch.js";

const router = express.Router();

// Many clients POST JSON here without a path segment; Express does not match `/:action` for that URL.
router.post("/", GameTradeRequestController.create);

// POST /api/game-trade-requests/:action  (create | accept | decline | aiCounter)
router.post("/:action", dispatch(GameTradeRequestController, [
  "create",
  "accept",
  "decline",
  "aiCounter",
]));

router.get("/:id", GameTradeRequestController.getById);
router.put("/:id", GameTradeRequestController.update);
router.delete("/:id", GameTradeRequestController.remove);

router.get("/game/:game_id", GameTradeRequestController.getByGameId);
router.get("/game/:game_id/player/:player_id", GameTradeRequestController.getByGameIdAndPlayerId);
router.get("/my/:game_id/player/:player_id", GameTradeRequestController.myTradeRequests);
router.get("/incoming/:game_id/player/:player_id", GameTradeRequestController.incomingTradeRequests);

export default router;
