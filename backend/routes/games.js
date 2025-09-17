import express from "express";
import gameController from "../controllers/gameController.js";

const router = express.Router();

// -------------------------
// 🔹 Game CRUD
// -------------------------
router.post("/", gameController.create);
router.get("/", gameController.findAll);
router.get("/:id", gameController.findById);
router.put("/:id", gameController.update);
router.delete("/:id", gameController.remove);

// -------------------------
// 🔹 Extra Endpoints
// -------------------------
router.get("/code/:code", gameController.findByCode);
router.get("/creator/:userId", gameController.findByCreator);
router.get("/winner/:userId", gameController.findByWinner);
router.get("/active", gameController.findActive);
router.get("/pending", gameController.findPending);

export default router;
