import express from "express";
import communityChestController from "../controllers/communityChestController.js";

const router = express.Router();

// -------------------------
// 🔹 Community Chest CRUD
// -------------------------
router.post("/", communityChestController.create);
router.get("/", communityChestController.findAll);
router.get("/:id", communityChestController.findById);
router.put("/:id", communityChestController.update);
router.delete("/:id", communityChestController.remove);

export default router;
