import express from "express";
import { GameTradeRequestController } from "../controllers/gameTradeRequestController.js";

const router = express.Router();

router.post("/", GameTradeRequestController.create);

router.get("/:id", GameTradeRequestController.getById);

router.put("/:id", GameTradeRequestController.update);

router.delete("/:id", GameTradeRequestController.remove);

router.get("/game/:game_id", GameTradeRequestController.getByGameId);

router.get(
  "/game/:game_id/player/:player_id",
  GameTradeRequestController.getByGameIdAndPlayerId
);

router.get(
  "/game/:game_id/player/:player_id/status/:status",
  GameTradeRequestController.getByGameIdAndPlayerIdAndStatus
);

export default router;
