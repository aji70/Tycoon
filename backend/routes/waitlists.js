import express from "express";
import waitlistController from "../controllers/waitlistController.js";

const router = express.Router();

// -------------------------
// 🔹 Property CRUD
// -------------------------
router.post("/", waitlistController.create);
router.get("/", waitlistController.findAll);
router.get("/:id", waitlistController.findById);
router.put("/:id", waitlistController.update);
router.delete("/:id", waitlistController.remove);

export default router;
