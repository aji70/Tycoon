import express from "express";
import chatController from "../controllers/chatController.js";

const router = express.Router();

// -------------------------
// 🔹 Chat CRUD
// -------------------------
router.post("/", chatController.create);
router.get("/", chatController.findAll);
router.get("/:id", chatController.findById);
router.put("/:id", chatController.update);
router.delete("/:id", chatController.remove);
router.get("/game/:id", chatController.findByGameId);
router.put("/game/:id", chatController.updateByGameId);
router.delete("/game/:id", chatController.removeByGameId);

export default router;
