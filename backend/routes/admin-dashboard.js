/**
 * Admin dashboard API — metrics and future moderation/economy routes.
 * Optional: TYCOON_ADMIN_SECRET + header x-tycoon-admin-secret on every request.
 */

import express from "express";
import * as adminDashboardController from "../controllers/adminDashboardController.js";
import { requireDashboardAdminSecret } from "../middleware/dashboardAdminAuth.js";

const router = express.Router();

router.use(requireDashboardAdminSecret);

router.get("/overview", adminDashboardController.getOverview);

export default router;
