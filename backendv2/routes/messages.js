import express from "express";
import messageController from "../controllers/messageController.js";

const router = express.Router();

// -------------------------
// 🔹 Message CRUD
// -------------------------
router.post("/", messageController.create);
router.get("/", messageController.findAll);
router.get("/:id", messageController.findById);
router.put("/:id", messageController.update);
router.delete("/:id", messageController.remove);
router.get("/game/:id", messageController.findByGameId);
router.get("/chat/:id", messageController.findByChatId);
export default router;
