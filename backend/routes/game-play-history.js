import express from "express";
import gamePlayHistoryController from "../controllers/gamePlayHistoryController.js";

const router = express.Router();

// -------------------------
// 🔹 CRUD
// -------------------------
router.post("/", gamePlayHistoryController.create);
router.get("/", gamePlayHistoryController.findAll);
router.get("/:id", gamePlayHistoryController.findById);
router.put("/:id", gamePlayHistoryController.update);
router.delete("/:id", gamePlayHistoryController.remove);

// -------------------------
// 🔹 Query by Game / Player
// -------------------------
router.get("/game/:gameId", gamePlayHistoryController.findByGame);
router.get("/player/:playerId", gamePlayHistoryController.findByPlayer);

export default router;
