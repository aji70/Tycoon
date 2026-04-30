import express from "express";
import userController from "../controllers/userController.js";

const router = express.Router();

// -------------------------
// 🔹 User CRUD
// -------------------------
router.post("/", userController.create);
router.get("/", userController.findAll);
// Leaderboard must be before /:id so "leaderboard" is not captured as id
router.get("/leaderboard", userController.getLeaderboard);
router.post("/sync-leaderboard", userController.syncLeaderboardFromChain);
router.get("/by-address/:address", userController.findByAddress);
router.get("/by-username/:username", userController.findByUsername);
router.get("/:id/property-stats", userController.getPropertyStats);
router.get("/:id", userController.findById);
router.put("/:id", userController.update);
router.delete("/:id", userController.remove);

export default router;
