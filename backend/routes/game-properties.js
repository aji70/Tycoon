import { Router } from "express";
import gamePropertyController from "../controllers/gamePropertyController.js";

const router = Router();

// CRUD
router.post("/", gamePropertyController.create);
router.post("/buy", gamePropertyController.buy);
router.post("/development", gamePropertyController.development);
router.post("/downgrade", gamePropertyController.downgrade);
router.get("/", gamePropertyController.findAll);
router.get("/:id", gamePropertyController.findById);
router.put("/:id", gamePropertyController.update);
router.delete("/:id", gamePropertyController.remove);

// Lookups
router.get("/game/:gameId", gamePropertyController.findByGame);
router.get("/player/:playerId", gamePropertyController.findByPlayer);

export default router;
