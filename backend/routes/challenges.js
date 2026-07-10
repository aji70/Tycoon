import express from "express";
import challengeController from "../controllers/challengeController.js";
import { requireAuthOrAddress } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuthOrAddress);

router.get("/", challengeController.list);
router.post("/", challengeController.create);
router.post("/:id/accept", challengeController.accept);
router.post("/:id/reject", challengeController.reject);

export default router;
