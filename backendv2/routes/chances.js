import express from "express";
import chanceController from "../controllers/chanceController.js";

const router = express.Router();

// -------------------------
// 🔹 Chance CRUD
// -------------------------
router.post("/", chanceController.create);
router.get("/", chanceController.findAll);
router.get("/:id", chanceController.findById);
router.put("/:id", chanceController.update);
router.delete("/:id", chanceController.remove);

export default router;
