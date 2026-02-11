import express from "express";
import propertyController from "../controllers/propertyController.js";

const router = express.Router();

// -------------------------
// 🔹 Property CRUD
// -------------------------
router.post("/", propertyController.create);
router.get("/", propertyController.findAll);
router.get("/:id", propertyController.findById);
router.put("/:id", propertyController.update);
router.delete("/:id", propertyController.remove);

export default router;
