import express from "express";
import { GameTradeRequestController } from "../controllers/gameTradeRequestController.js";

const router = express.Router();

router.post("/", GameTradeRequestController.create);

router.post("/accept", GameTradeRequestController.accept);

router.post("/decline", GameTradeRequestController.decline);

router.get("/:id", GameTradeRequestController.getById);

router.put("/:id", GameTradeRequestController.update);

router.delete("/:id", GameTradeRequestController.remove);

router.get("/game/:game_id", GameTradeRequestController.getByGameId);

router.get(
  "/game/:game_id/player/:player_id",
  GameTradeRequestController.getByGameIdAndPlayerId
);

router.get(
  "/game/:game_id/player/:player_id",
  GameTradeRequestController.getByGameIdAndPlayerIdAndStatus
);

export default router;
