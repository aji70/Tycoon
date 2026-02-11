import express from "express";
import gameTradeController from "../controllers/gameTradeController.js";

const router = express.Router();

// -------------------------
// 🔹 CRUD
// -------------------------
router.post("/", gameTradeController.create);
router.get("/", gameTradeController.findAll);
router.get("/:id", gameTradeController.findById);
router.put("/:id", gameTradeController.update);
router.delete("/:id", gameTradeController.remove);

// -------------------------
// 🔹 Query by Game / Player
// -------------------------
router.get("/game/:gameId", gameTradeController.findByGame);
router.get("/player/:playerId", gameTradeController.findByPlayer);

// -------------------------
// 🔹 Accept Trade
// -------------------------
router.post("/:id/accept", gameTradeController.accept);


export default router;
