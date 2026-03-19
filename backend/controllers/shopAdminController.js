/**
 * Shop admin endpoints - stock perks and bundles on-chain.
 * These endpoints require admin authentication.
 * Uses the backend's private key to call reward system contract functions.
 */
import * as rewardSystemContract from "../services/rewardSystemContract.js";
import logger from "../config/logger.js";

/**
 * POST /api/shop-admin/stock-perk
 * Stock a new perk in the shop.
 * Body: { amount, perk (0-7), strength, tycPrice, usdcPrice }
 */
export async function stockPerk(req, res) {
  try {
    const { amount, perk, strength, tycPrice, usdcPrice } = req.body;

    // Validate inputs
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: "amount must be > 0" });
    }
    if (perk === undefined || perk < 0 || perk > 7) {
      return res.status(400).json({ success: false, error: "perk must be 0-7" });
    }
    if (!strength || strength <= 0) {
      return res.status(400).json({ success: false, error: "strength must be > 0" });
    }
    if (!tycPrice && !usdcPrice) {
      return res.status(400).json({ success: false, error: "need at least one price (tycPrice or usdcPrice)" });
    }

    logger.info(`stockPerk request: amount=${amount}, perk=${perk}, strength=${strength}, tycPrice=${tycPrice}, usdcPrice=${usdcPrice}`);

    const result = await rewardSystemContract.stockShop(
      BigInt(amount),
      perk,
      BigInt(strength),
      BigInt(tycPrice || 0),
      BigInt(usdcPrice || 0),
      "CELO"
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.error("stockPerk error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to stock perk",
    });
  }
}

/**
 * POST /api/shop-admin/restock-perk
 * Restock an existing perk.
 * Body: { tokenId, additionalAmount }
 */
export async function restockPerk(req, res) {
  try {
    const { tokenId, additionalAmount } = req.body;

    if (!tokenId || tokenId <= 0) {
      return res.status(400).json({ success: false, error: "tokenId required" });
    }
    if (!additionalAmount || additionalAmount <= 0) {
      return res.status(400).json({ success: false, error: "additionalAmount must be > 0" });
    }

    logger.info(`restockPerk request: tokenId=${tokenId}, additionalAmount=${additionalAmount}`);

    const result = await rewardSystemContract.restockCollectible(
      BigInt(tokenId),
      BigInt(additionalAmount),
      "CELO"
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.error("restockPerk error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to restock perk",
    });
  }
}

/**
 * POST /api/shop-admin/update-perk-prices
 * Update prices for a perk.
 * Body: { tokenId, newTycPrice, newUsdcPrice }
 */
export async function updatePerkPrices(req, res) {
  try {
    const { tokenId, newTycPrice, newUsdcPrice } = req.body;

    if (!tokenId || tokenId <= 0) {
      return res.status(400).json({ success: false, error: "tokenId required" });
    }
    if (!newTycPrice && !newUsdcPrice) {
      return res.status(400).json({ success: false, error: "need at least one price (newTycPrice or newUsdcPrice)" });
    }

    logger.info(`updatePerkPrices request: tokenId=${tokenId}, newTycPrice=${newTycPrice}, newUsdcPrice=${newUsdcPrice}`);

    const result = await rewardSystemContract.updateCollectiblePrices(
      BigInt(tokenId),
      BigInt(newTycPrice || 0),
      BigInt(newUsdcPrice || 0),
      "CELO"
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.error("updatePerkPrices error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to update perk prices",
    });
  }
}

/**
 * POST /api/shop-admin/stock-bundle
 * Create a new bundle.
 * Body: { tokenIds: [id1, id2, ...], amounts: [amt1, amt2, ...], tycPrice, usdcPrice }
 */
export async function stockBundle(req, res) {
  try {
    const { tokenIds, amounts, tycPrice, usdcPrice } = req.body;

    if (!tokenIds || !Array.isArray(tokenIds) || tokenIds.length === 0) {
      return res.status(400).json({ success: false, error: "tokenIds must be non-empty array" });
    }
    if (!amounts || !Array.isArray(amounts) || amounts.length !== tokenIds.length) {
      return res.status(400).json({ success: false, error: "amounts must match tokenIds length" });
    }
    if (!tycPrice && !usdcPrice) {
      return res.status(400).json({ success: false, error: "need at least one price (tycPrice or usdcPrice)" });
    }

    logger.info(`stockBundle request: tokenIds=${tokenIds.join(",")}, amounts=${amounts.join(",")}, tycPrice=${tycPrice}, usdcPrice=${usdcPrice}`);

    const bigIntTokenIds = tokenIds.map(id => BigInt(id));
    const bigIntAmounts = amounts.map(amt => BigInt(amt));

    const result = await rewardSystemContract.stockBundle(
      bigIntTokenIds,
      bigIntAmounts,
      BigInt(tycPrice || 0),
      BigInt(usdcPrice || 0),
      "CELO"
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.error("stockBundle error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to create bundle",
    });
  }
}

/**
 * POST /api/shop-admin/bundle-active
 * Activate or deactivate a bundle.
 * Body: { bundleId, active: true/false }
 */
export async function setBundleActive(req, res) {
  try {
    const { bundleId, active } = req.body;

    if (!bundleId || bundleId <= 0) {
      return res.status(400).json({ success: false, error: "bundleId required" });
    }
    if (active === undefined) {
      return res.status(400).json({ success: false, error: "active (boolean) required" });
    }

    logger.info(`setBundleActive request: bundleId=${bundleId}, active=${active}`);

    const result = await rewardSystemContract.setBundleActive(
      BigInt(bundleId),
      Boolean(active),
      "CELO"
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.error("setBundleActive error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to update bundle status",
    });
  }
}
