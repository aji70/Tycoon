/**
 * Admin dashboard API — metrics and future moderation/economy routes.
 * Optional: TYCOON_ADMIN_SECRET + header x-tycoon-admin-secret on every request.
 */

import express from "express";
import * as adminDashboardController from "../controllers/adminDashboardController.js";
import * as adminPlayersController from "../controllers/adminPlayersController.js";
import * as adminRoomsController from "../controllers/adminRoomsController.js";
import * as adminPropertiesController from "../controllers/adminPropertiesController.js";
import * as adminEconomyController from "../controllers/adminEconomyController.js";
import * as adminLeaderboardController from "../controllers/adminLeaderboardController.js";
import * as adminAnalyticsController from "../controllers/adminAnalyticsController.js";
import * as adminWalletsController from "../controllers/adminWalletsController.js";
import * as adminSettingsController from "../controllers/adminSettingsController.js";
import * as adminModerationController from "../controllers/adminModerationController.js";
import * as adminAuditLogController from "../controllers/adminAuditLogController.js";
import * as adminSearchController from "../controllers/adminSearchController.js";
import { requireDashboardAdminSecret } from "../middleware/dashboardAdminAuth.js";

const router = express.Router();

router.use(requireDashboardAdminSecret);

router.get("/overview", adminDashboardController.getOverview);
router.get("/search", adminSearchController.search);
router.get("/players", adminPlayersController.listPlayers);
router.get("/players/:id", adminPlayersController.getPlayerById);

router.get("/rooms", adminRoomsController.listRooms);
router.post("/rooms/bulk-cancel", adminRoomsController.bulkCancelRooms);
router.post("/rooms/:id/cancel", adminRoomsController.cancelRoom);
router.get("/rooms/:id", adminRoomsController.getRoomById);

router.get("/properties", adminPropertiesController.listProperties);
router.patch("/properties/:id", adminPropertiesController.patchProperty);
router.get("/properties/:id", adminPropertiesController.getProperty);

router.get("/economy/overview", adminEconomyController.getEconomyOverview);
router.get("/economy/config", adminEconomyController.getEconomyConfig);
router.post("/economy/grant-voucher", adminEconomyController.grantVoucher);

router.get("/leaderboard", adminLeaderboardController.getLeaderboard);

router.get("/analytics/dashboard", adminAnalyticsController.dashboard);
router.get("/analytics/activity", adminAnalyticsController.activity);

router.get("/wallets", adminWalletsController.listWallets);
router.get("/settings/summary", adminSettingsController.getSettingsSummary);

router.get("/audit-log", adminAuditLogController.listAuditLog);

router.get("/moderation/reports", adminModerationController.listReports);
router.post("/moderation/reports", adminModerationController.createReport);
router.get("/moderation/reports/:id", adminModerationController.getReportById);
router.patch("/moderation/reports/:id", adminModerationController.patchReport);

export default router;
