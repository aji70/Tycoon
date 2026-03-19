/**
 * Shop admin routes - stock perks and bundles using the backend's private key.
 * These endpoints call the reward system contract to add items to the shop.
 * NOTE: Should require admin authentication (add middleware as needed).
 */

import express from "express";
import * as shopAdminController from "../controllers/shopAdminController.js";

const router = express.Router();

/**
 * POST /api/shop-admin/stock-perk
 * Stock a new perk in the shop.
 * Body: { amount, perk (0-7), strength, tycPrice, usdcPrice }
 * Returns: { success, data: { txHash, blockNumber } }
 */
router.post("/stock-perk", shopAdminController.stockPerk);

/**
 * POST /api/shop-admin/restock-perk
 * Restock an existing perk.
 * Body: { tokenId, additionalAmount }
 * Returns: { success, data: { txHash, blockNumber } }
 */
router.post("/restock-perk", shopAdminController.restockPerk);

/**
 * POST /api/shop-admin/update-perk-prices
 * Update prices for a perk.
 * Body: { tokenId, newTycPrice, newUsdcPrice }
 * Returns: { success, data: { txHash, blockNumber } }
 */
router.post("/update-perk-prices", shopAdminController.updatePerkPrices);

/**
 * POST /api/shop-admin/stock-bundle
 * Create a new bundle.
 * Body: { tokenIds: [id1, id2, ...], amounts: [amt1, amt2, ...], tycPrice, usdcPrice }
 * Returns: { success, data: { txHash, blockNumber } }
 */
router.post("/stock-bundle", shopAdminController.stockBundle);

/**
 * POST /api/shop-admin/bundle-active
 * Activate or deactivate a bundle.
 * Body: { bundleId, active: true/false }
 * Returns: { success, data: { txHash, blockNumber } }
 */
router.post("/bundle-active", shopAdminController.setBundleActive);

export default router;
