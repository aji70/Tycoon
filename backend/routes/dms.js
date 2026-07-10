import express from "express";
import dmController from "../controllers/dmController.js";
import { requireAuthOrAddress } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuthOrAddress);

router.get("/", dmController.list);
router.post("/open", dmController.open);
router.post("/with/:userId", dmController.openWith);
router.get("/:id/messages", dmController.listMessages);
router.post("/:id/messages", dmController.send);

export default router;
