import express from "express";
import gamePlayerController from "../controllers/gamePlayerController.js";
import { dispatch } from "../utils/dispatch.js";

const router = express.Router();

// CRUD
router.post("/", gamePlayerController.create);
router.get("/", gamePlayerController.findAll);
router.get("/:id", gamePlayerController.findById);
router.put("/:id", gamePlayerController.update);
router.delete("/:id", gamePlayerController.remove);

// Lookups
router.get("/game/:gameId", gamePlayerController.findByGame);
router.get("/user/:userId", gamePlayerController.findByUser);

// POST /api/game-players/:action
router.post("/:action", dispatch(gamePlayerController, [
  "join",
  "leave",
  "changePosition",
  "threeDoublesToJail",
  "payToLeaveJail",
  "stayInJail",
  "useGetOutOfJailFree",
  "endTurn",
  "declineBuy",
  "canRoll",
  "removeInactive",
  "recordTimeout",
  "voteToRemove",
  "getVoteStatus",
  "voteEndByNetWorth",
  "getEndByNetWorthStatus",
]));

export default router;
