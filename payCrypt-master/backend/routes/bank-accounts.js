import express from "express";
import {
  getBankAccountById,
  updateBankAccount,
  deleteBankAccount,
  getBankAccountByUserId,
} from "../controllers/bankAccountController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, getBankAccountByUserId);
router.get("/:id", authenticate, getBankAccountById);
router.put("/:id", authenticate, updateBankAccount);
router.delete("/:id", authenticate, deleteBankAccount);

export default router;
