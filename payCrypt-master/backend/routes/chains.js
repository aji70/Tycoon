import express from "express";
import {
  createChain,
  getChains,
  getChainById,
  updateChain,
  deleteChain,
} from "../controllers/chainController.js";
const router = express.Router();

router.post("/", createChain);
router.get("/", getChains);
router.get("/:id", getChainById);
router.put("/:id", updateChain);
router.delete("/:id", deleteChain);

export default router;
