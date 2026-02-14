import express from "express";
import gameController, {
  create,
  join,
  leave,
  createAsGuest,
  joinAsGuest,
  createAIAsGuest,
} from "../controllers/gameController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// -------------------------
// 🔹 Extra Endpoints
// -------------------------
router.get("/code/:code", gameController.findByCode);
router.get("/creator/:userId", gameController.findByCreator);
router.get("/winner/:userId", gameController.findByWinner);
router.get("/active", gameController.findActive);
router.get("/pending", gameController.findPending);

// -------------------------
// 🔹 Game CRUD
// -------------------------
router.post("/", gameController.create);
router.get("/", gameController.findAll);
router.get("/:id/winner-by-net-worth", gameController.getWinnerByNetWorth);
router.post("/:id/finish-by-time", gameController.finishByTime);
router.get("/:id", gameController.findById);
router.put("/:id", gameController.update);
router.delete("/:id", gameController.remove);

router.post("/create", create);
router.post("/join", join);
router.post("/leave", leave);
router.post("/create-as-guest", requireAuth, createAsGuest);
router.post("/create-ai-as-guest", requireAuth, createAIAsGuest);
router.post("/join-as-guest", requireAuth, joinAsGuest);

export default router;
