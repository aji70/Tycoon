import express from "express";
import {
  createBalance,
  getBalances,
  getBalanceById,
  updateBalance,
  deleteBalance,
  getBalanceByUser,
} from "../controllers/balanceController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authenticate, createBalance);
router.get("/all", authenticate, getBalances);
router.get("/", authenticate, getBalanceByUser);
router.get("/:id", authenticate, getBalanceById);
router.put("/:id", authenticate, updateBalance);
router.delete("/:id", authenticate, deleteBalance);

export default router;
