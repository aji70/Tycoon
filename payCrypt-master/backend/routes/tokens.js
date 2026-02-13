import express from "express";
import {
  createToken,
  getTokens,
  getTokenById,
  updateToken,
  deleteToken,
} from "../controllers/tokenController.js";
import { authenticate } from "../middleware/auth.js";
const router = express.Router();

router.post("/", createToken);
router.get("/", getTokens);
router.get("/:id", getTokenById);
router.put("/:id", updateToken);
router.delete("/:id", deleteToken);

export default router;
