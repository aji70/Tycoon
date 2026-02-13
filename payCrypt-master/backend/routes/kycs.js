import express from "express";
import {
  createKyc,
  getKycById,
  updateKyc,
  deleteKyc,
  getKycByUser,
} from "../controllers/kycController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authenticate, createKyc);
router.get("/", authenticate, getKycByUser);
router.get("/:id", authenticate, getKycById);
router.put("/:id", authenticate, updateKyc);
router.delete("/:id", authenticate, deleteKyc);

export default router;
