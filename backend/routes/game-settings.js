import express from "express";
import gameSettingController from "../controllers/gameSettingController.js";

const router = express.Router();

// -------------------------
// 🔹 CRUD
// -------------------------
router.post("/", gameSettingController.create);
router.get("/", gameSettingController.findAll);
router.get("/:id", gameSettingController.findById);
router.put("/:id", gameSettingController.update);
router.delete("/:id", gameSettingController.remove);

// -------------------------
// 🔹 By Game ID
// -------------------------
router.get("/game/:gameId", gameSettingController.findByGameId);
router.put("/game/:gameId", gameSettingController.updateByGameId);
router.delete("/game/:gameId", gameSettingController.removeByGameId);

export default router;
