import express from "express";
import gamePlayerController from "../controllers/gamePlayerController.js";

const router = express.Router();

// -------------------------
// 🔹 CRUD
// -------------------------
router.post("/", gamePlayerController.create);
router.post("/join", gamePlayerController.join);
router.post("/leave", gamePlayerController.leave);
router.get("/", gamePlayerController.findAll);
router.get("/:id", gamePlayerController.findById);
router.put("/:id", gamePlayerController.update);
router.delete("/:id", gamePlayerController.remove);
router.get("/by-address/:address", gamePlayerController.findByAddress);

// -------------------------
// 🔹 By Game / User
// -------------------------
router.get("/game/:gameId", gamePlayerController.findByGame);
router.get("/user/:userId", gamePlayerController.findByUser);

router.post("/change-position", gamePlayerController.changePosition);
router.post("/end-turn", gamePlayerController.endTurn);
router.post("/can-roll", gamePlayerController.canRoll);
export default router;
