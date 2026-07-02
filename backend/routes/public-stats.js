import express from "express";
import * as publicStatsController from "../controllers/publicStatsController.js";

const router = express.Router();

router.get("/stats", publicStatsController.getPublicStats);

export default router;
