import { formatUnits } from "ethers";
import logger from "../config/logger.js";
import db from "../config/database.js";
import {
  isGoodDollarShopEnabled,
  getGoodDollarTokenAddress,
  getGoodDollarTreasury,
  getGoodDollarUsdRate,
  usdToGoodDollarWei,
  usdcWeiToGoodDollarWei,
  formatGoodDollarDisplay,
  verifyGoodDollarTransfer,
  GOODDOLLAR_DECIMALS,
} from "../services/gooddollarPayment.js";
import {
  readCollectibleUsdcPrice,
  readBundleInfo,
  deliverCollectibleToUser,
  deliverBundleToUser,
} from "../services/tycoonContract.js";
import { resolveMinipayShopDeliveryAddress } from "../services/shopFulfillment.js";

const BUNDLE_USDC_PRICES = {
  1: 2.5,
  2: 3,
  3: 2.75,
  4: 3.25,
  5: 3.5,
  6: 4,
  7: 2.5,
  8: 4.5,
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function badRequest(res, message, extra = {}) {
  return res.status(400).json({ success: false, message, ...extra });
}

function isAddr(value) {
  const s = String(value || "").trim();
  return /^0x[a-fA-F0-9]{40}$/.test(s) && s.toLowerCase() !== ZERO_ADDRESS;
}

async function resolveExpectedAmountWei({ tokenId, bundleId }) {
  if (tokenId) {
    const { usdcPriceWei } = await readCollectibleUsdcPrice(tokenId, "CELO");
    if (usdcPriceWei <= 0n) {
      throw new Error("Collectible is not for sale (USDC price not set).");
    }
    const usdPrice = Number(formatUnits(usdcPriceWei, 6));
    const gdWei = usdcWeiToGoodDollarWei(usdcPriceWei);
    if (gdWei <= 0n) throw new Error("Could not derive G$ price for this perk.");
    return { amountGdWei: gdWei, usdPrice };
  }
  if (bundleId) {
    const bundle = await readBundleInfo(bundleId, "CELO");
    if (!bundle.active) throw new Error("Bundle is inactive.");
    let usdPrice = BUNDLE_USDC_PRICES[Number(bundleId)];
    let usdcWei = 0n;
    if (bundle.usdcPriceWei > 0n) {
      usdcWei = bundle.usdcPriceWei;
      if (!usdPrice) usdPrice = Number(formatUnits(bundle.usdcPriceWei, 6));
    } else if (usdPrice && usdPrice > 0) {
      usdcWei = BigInt(Math.round(usdPrice * 1e6));
    }
    if (!usdPrice || usdPrice <= 0 || usdcWei <= 0n) {
      throw new Error("Bundle USD price not configured.");
    }
    const gdWei = usdcWeiToGoodDollarWei(usdcWei);
    if (gdWei <= 0n) throw new Error("Could not derive G$ price for this bundle.");
    return { amountGdWei: gdWei, usdPrice };
  }
  throw new Error("token_id or bundle_id required");
}

/** GET /api/shop/gooddollar/config */
export async function gooddollarConfig(_req, res) {
  try {
    const enabled = isGoodDollarShopEnabled();
    res.json({
      success: true,
      data: {
        enabled,
        token_address: getGoodDollarTokenAddress(),
        treasury_address: getGoodDollarTreasury(),
        usd_rate: getGoodDollarUsdRate(),
        decimals: GOODDOLLAR_DECIMALS,
      },
    });
  } catch (err) {
    logger.error({ err: err?.message }, "gooddollarConfig error");
    res.status(500).json({ success: false, message: "Failed to load G$ shop config" });
  }
}

/** GET /api/shop/gooddollar/price?token_id=... | bundle_id=... */
export async function gooddollarPrice(req, res) {
  try {
    const tokenIdRaw = String(req.query?.token_id ?? req.query?.tokenId ?? "").trim();
    const bundleIdRaw = String(req.query?.bundle_id ?? req.query?.bundleId ?? "").trim();
    const tokenId = tokenIdRaw && /^[0-9]+$/.test(tokenIdRaw) ? tokenIdRaw : null;
    const bundleId = bundleIdRaw && /^[0-9]+$/.test(bundleIdRaw) ? Number(bundleIdRaw) : null;
    if (!tokenId && !bundleId) return badRequest(res, "token_id or bundle_id query param required");

    const { amountGdWei, usdPrice } = await resolveExpectedAmountWei({ tokenId, bundleId });
    res.json({
      success: true,
      data: {
        token_id: tokenId,
        bundle_id: bundleId,
        amount_gd_wei: amountGdWei.toString(),
        amount_gd: formatGoodDollarDisplay(amountGdWei),
        usd_price: usdPrice,
        usd_rate: getGoodDollarUsdRate(),
        treasury_address: getGoodDollarTreasury(),
        token_address: getGoodDollarTokenAddress(),
      },
    });
  } catch (err) {
    logger.warn({ err: err?.message, query: req.query }, "gooddollarPrice error");
    res.status(400).json({ success: false, message: err?.message || "Failed to price in G$" });
  }
}

/**
 * POST /api/shop/gooddollar/claim
 * body: { tx_hash, token_id?|bundle_id?, address? }
 * Flow: verify G$ Transfer log on Celo → deliverCollectible/Bundle via minter → persist.
 */
export async function gooddollarClaim(req, res) {
  const userId = req.user?.id;
  const txHash = String(req.body?.tx_hash ?? req.body?.txHash ?? "").trim();
  const tokenIdRaw = String(req.body?.token_id ?? req.body?.tokenId ?? "").trim();
  const bundleIdRaw = String(req.body?.bundle_id ?? req.body?.bundleId ?? "").trim();
  const tokenId = tokenIdRaw && /^[0-9]+$/.test(tokenIdRaw) ? tokenIdRaw : null;
  const bundleId = bundleIdRaw && /^[0-9]+$/.test(bundleIdRaw) ? Number(bundleIdRaw) : null;
  const requestedAddress = String(req.body?.address ?? "").trim();

  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return badRequest(res, "Valid tx_hash is required");
  if (!tokenId && !bundleId) return badRequest(res, "token_id or bundle_id required");
  if (tokenId && bundleId) return badRequest(res, "Only one of token_id or bundle_id");

  if (!isGoodDollarShopEnabled()) {
    return res.status(503).json({ success: false, message: "G$ shop is not configured on this server." });
  }

  const treasury = getGoodDollarTreasury();
  if (!treasury) {
    return res.status(503).json({ success: false, message: "GD_SHOP_TREASURY_ADDRESS not set." });
  }

  const user = userId ? await db("users").where({ id: userId }).first() : null;
  const deliveryAddress =
    (user ? resolveMinipayShopDeliveryAddress(user, requestedAddress) : null) ||
    (isAddr(requestedAddress) ? requestedAddress : null);
  if (!deliveryAddress || !isAddr(deliveryAddress)) {
    return res.status(400).json({
      success: false,
      message: "No delivery wallet on file. Connect your MiniPay wallet before paying with G$.",
    });
  }

  let expected;
  try {
    expected = await resolveExpectedAmountWei({ tokenId, bundleId });
  } catch (err) {
    return badRequest(res, err?.message || "Failed to resolve expected G$ price");
  }

  const insertPayload = {
    tx_hash: txHash,
    user_id: userId ?? null,
    buyer_address: deliveryAddress,
    delivery_address: deliveryAddress,
    token_id: tokenId,
    bundle_id: bundleId,
    amount_gd_wei: expected.amountGdWei.toString(),
    status: "pending",
  };

  try {
    await db("gooddollar_shop_purchases").insert(insertPayload);
  } catch (err) {
    const existing = await db("gooddollar_shop_purchases").where({ tx_hash: txHash }).first();
    if (existing) {
      if (existing.status === "completed") {
        return res.json({ success: true, already_delivered: true, status: "completed" });
      }
      if (existing.status === "processing") {
        return res.status(202).json({ success: true, status: "processing" });
      }
    } else {
      logger.error({ err: err?.message, txHash }, "gooddollarClaim insert failed");
      return res.status(500).json({ success: false, message: "Failed to record purchase" });
    }
  }

  const claimed = await db("gooddollar_shop_purchases")
    .where({ tx_hash: txHash, status: "pending" })
    .update({ status: "processing", updated_at: db.fn.now() });
  if (claimed === 0) {
    const row = await db("gooddollar_shop_purchases").where({ tx_hash: txHash }).first();
    if (row?.status === "completed") {
      return res.json({ success: true, already_delivered: true, status: "completed" });
    }
    return res.status(202).json({ success: true, status: row?.status || "processing" });
  }

  let verified;
  try {
    verified = await verifyGoodDollarTransfer({
      txHash,
      expectedFrom: deliveryAddress,
      expectedTo: treasury,
      minAmountWei: expected.amountGdWei,
    });
  } catch (err) {
    await db("gooddollar_shop_purchases")
      .where({ tx_hash: txHash })
      .update({
        status: "failed",
        error: String(err?.message || "verify failed").slice(0, 400),
        updated_at: db.fn.now(),
      });
    logger.warn({ err: err?.message, txHash, deliveryAddress, treasury }, "G$ verify failed");
    return res.status(400).json({ success: false, message: err?.message || "G$ transfer verification failed" });
  }

  try {
    let deliveryResult;
    if (tokenId) {
      deliveryResult = await deliverCollectibleToUser(deliveryAddress, tokenId, "CELO");
    } else {
      deliveryResult = await deliverBundleToUser(deliveryAddress, bundleId, "CELO");
    }
    await db("gooddollar_shop_purchases")
      .where({ tx_hash: txHash })
      .update({
        status: "completed",
        delivery_tx_hash: deliveryResult?.hash || null,
        fulfilled_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
    logger.info(
      {
        txHash,
        deliveryAddress,
        tokenId,
        bundleId,
        amountGdWei: verified.valueWei.toString(),
        deliveryTxHash: deliveryResult?.hash,
      },
      "G$ shop purchase fulfilled"
    );
    return res.json({
      success: true,
      status: "completed",
      delivery_tx_hash: deliveryResult?.hash || null,
      amount_gd_wei: verified.valueWei.toString(),
    });
  } catch (err) {
    await db("gooddollar_shop_purchases")
      .where({ tx_hash: txHash })
      .update({
        status: "pending",
        error: String(err?.message || "deliver failed").slice(0, 400),
        updated_at: db.fn.now(),
      });
    logger.error({ err: err?.message, txHash, deliveryAddress }, "G$ delivery failed; left pending for retry");
    return res.status(500).json({
      success: false,
      message: "Payment verified but perk delivery failed. Contact support with your tx hash.",
      tx_hash: txHash,
    });
  }
}
