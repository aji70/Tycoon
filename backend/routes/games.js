import express from "express";
import gameController, {
  create,
  join,
  leave,
  changePosition,
  startGame,
} from "../controllers/gameController.js";

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
router.get("/:id", gameController.findById);
router.put("/:id", gameController.update);
router.delete("/:id", gameController.remove);

router.post("/create", create);
router.post("/join", join);
router.post("/leave", leave);
router.post("/position", changePosition);
router.post("/start", startGame);

export default router;
