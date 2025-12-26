import express from "express";
import userController from "../controllers/userController.js";

const router = express.Router();

// -------------------------
// 🔹 User CRUD
// -------------------------
router.post("/", userController.create);
router.get("/", userController.findAll);
router.get("/:id", userController.findById);
router.get("/by-address/:address", userController.findByAddress);
router.put("/:id", userController.update);
router.delete("/:id", userController.remove);

// -------------------------
// 🏆 Leaderboards
// -------------------------
router.get("/leaderboard/wins", userController.leaderboardByWins);
router.get("/leaderboard/earnings", userController.leaderboardByEarnings);
router.get("/leaderboard/stakes", userController.leaderboardByStakes);
router.get("/leaderboard/winrate", userController.leaderboardByWinRate);

export default router;
