import crypto from "crypto";
import logger from "../config/logger.js";
import db from "../config/database.js";
import { MIN_FLUTTERWAVE_CHECKOUT_NGN } from "../constants/ngnPayments.js";
import { initializePayment, isFlutterwaveConfigured, verifyWebhookSignature, verifyTransactionById, verifyTransactionByReference } from "../services/flutterwave.js";
import { deliverBundleToUser, deliverCollectibleToUser } from "../services/tycoonContract.js";

/**
 * Same base resolution as CELO Naira purchase (guestAuthController.celoPurchaseInitialize):
 * use client callback if it looks like a URL, else FRONTEND_URL / PUBLIC_APP_URL, else localhost.
 * Ensures Flutterwave always gets a valid redirect_url when keys work for buy-CELO.
 * Client normally sends .../game-shop; if they send origin only, append /game-shop.
 */
function resolveShopFlutterwaveRedirect(callbackFromBody) {
  const trimmed = String(callbackFromBody || "").trim().replace(/\/$/, "");
  let base = trimmed.startsWith("http")
    ? trimmed
    : (process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || "").replace(/\/$/, "").trim();
  if (!base || !base.startsWith("http")) {
    base = "http://localhost:3000";
  }
  if (/\/game-shop$/i.test(base)) {
    return base;
  }
  return `${base}/game-shop`;
}

function clientSafeErrorMessage(err, fallback) {
  const m = err && typeof err.message === "string" ? err.message.trim() : "";
  if (!m) return fallback;
  return m.length > 600 ? `${m.slice(0, 600)}…` : m;
}

/**
 * GET /api/shop/bundles
 * List available shop bundles/packs
 * Returns pre-configured bundles with prices
 */
/**
 * Calculate NGN price with discount for purchases over 1000 NGN
 * Minimum purchase: Flutterwave checkout floor
 * Discount: 20% off for amounts > 1000 NGN
 */
const calculateNgnPrice = (baseNgnPrice) => {
  const minNgnPurchase = MIN_FLUTTERWAVE_CHECKOUT_NGN;
  if (baseNgnPrice < minNgnPurchase) return minNgnPurchase;
  if (baseNgnPrice > 1000) return Math.round(baseNgnPrice * 0.8);
  return baseNgnPrice;
};

export async function listBundles(_req, res) {
  try {
    // Pre-configured bundles with pricing (these are stocked via the admin "stock all bundles" endpoint)
    // Naira conversion: 1 USDC = 1600 NGN
    const USDC_TO_NGN_RATE = 1600;
    const bundles = [
      { id: 1, name: "Starter Pack", description: "Shield, Roll Boost, and Exact Roll — great for new players.", price_tyc: "45", price_usdc: "2.5", price_ngn: calculateNgnPrice(Math.round(2.5 * USDC_TO_NGN_RATE)) },
      { id: 2, name: "Lucky Bundle", description: "Jail Free, Teleport, and Lucky 7. Get out of tight spots.", price_tyc: "60", price_usdc: "3", price_ngn: calculateNgnPrice(Math.round(3 * USDC_TO_NGN_RATE)) },
      { id: 3, name: "Defender Pack", description: "Shield, Jail Free, and Roll Boost. Stay in the game when the board turns against you.", price_tyc: "55", price_usdc: "2.75", price_ngn: calculateNgnPrice(Math.round(2.75 * USDC_TO_NGN_RATE)) },
      { id: 4, name: "High Roller", description: "Double Rent, Roll Boost, and Exact Roll. Maximize income and land where it hurts.", price_tyc: "65", price_usdc: "3.25", price_ngn: calculateNgnPrice(Math.round(3.25 * USDC_TO_NGN_RATE)) },
      { id: 5, name: "Cash Flow", description: "Instant Cash, Property Discount, and Tax Refund (tiered). Keep your balance healthy.", price_tyc: "70", price_usdc: "3.5", price_ngn: calculateNgnPrice(Math.round(3.5 * USDC_TO_NGN_RATE)) },
      { id: 6, name: "Chaos Bundle", description: "Teleport, Exact Roll, and Lucky 7. Control the board and bend the dice.", price_tyc: "75", price_usdc: "4", price_ngn: calculateNgnPrice(Math.round(4 * USDC_TO_NGN_RATE)) },
      { id: 7, name: "Landlord's Choice", description: "Rent Cashback, Interest, and Free Parking Bonus. Rewards for property owners and patient play.", price_tyc: "50", price_usdc: "2.5", price_ngn: calculateNgnPrice(Math.round(2.5 * USDC_TO_NGN_RATE)) },
      { id: 8, name: "Ultimate Pack", description: "A bit of everything to dominate the board.", price_tyc: "80", price_usdc: "4.5", price_ngn: calculateNgnPrice(Math.round(4.5 * USDC_TO_NGN_RATE)) },
    ];

    res.json({
      success: true,
      data: {
        bundles,
        ngn_available: isFlutterwaveConfigured(),
      }
    });
  } catch (err) {
    logger.error({ err: err?.message }, "listBundles error");
    res.status(500).json({ success: false, message: "Failed to list bundles" });
  }
}

/**
 * POST /api/shop/paystack/initialize
 * Initialize a Paystack payment
 */
export async function paystackInitialize(_req, res) {
  try {
    // TODO: Initialize Paystack payment
    res.status(501).json({ success: false, message: "Paystack integration not yet configured" });
  } catch (err) {
    logger.error({ err: err?.message }, "paystackInitialize error");
    res.status(500).json({ success: false, message: "Failed to initialize payment" });
  }
}

/**
 * GET /api/shop/paystack/verify
 * Verify a Paystack payment
 */
export async function paystackVerify(_req, res) {
  try {
    // TODO: Verify Paystack payment with reference
    res.status(501).json({ success: false, message: "Paystack verification not yet configured" });
  } catch (err) {
    logger.error({ err: err?.message }, "paystackVerify error");
    res.status(500).json({ success: false, message: "Failed to verify payment" });
  }
}

/**
 * POST /api/shop/paystack/webhook
 * Receive Paystack webhook events
 */
export async function paystackWebhook(_req, res) {
  try {
    // TODO: Handle Paystack webhook
    logger.info("Paystack webhook received");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err: err?.message }, "paystackWebhook error");
    res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
}

/**
 * GET /api/shop/flutterwave/status
 * Get Flutterwave service status
 */
export async function flutterwaveStatus(_req, res) {
  try {
    res.json({ success: true, status: isFlutterwaveConfigured() ? "configured" : "unconfigured" });
  } catch (err) {
    logger.error({ err: err?.message }, "flutterwaveStatus error");
    res.status(500).json({ success: false, message: "Failed to get status" });
  }
}

/**
 * POST /api/shop/flutterwave/initialize-test
 * Initialize a test Flutterwave payment
 */
export async function flutterwaveInitializeTest(_req, res) {
  try {
    // TODO: Initialize test Flutterwave payment
    res.status(501).json({ success: false, message: "Flutterwave test integration not yet configured" });
  } catch (err) {
    logger.error({ err: err?.message }, "flutterwaveInitializeTest error");
    res.status(500).json({ success: false, message: "Failed to initialize test payment" });
  }
}

/**
 * POST /api/shop/flutterwave/initialize
 * Initialize a Flutterwave payment
 */
export async function flutterwaveInitialize(_req, res) {
  try {
    if (!isFlutterwaveConfigured()) {
      return res.status(503).json({ success: false, message: "NGN payments not configured" });
    }
    const userId = _req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const bundleId = Number(_req.body?.bundle_id);
    if (!Number.isInteger(bundleId) || bundleId < 1) {
      return res.status(400).json({ success: false, message: "Valid bundle_id is required" });
    }
    const bundle = await db("perk_bundles").where({ id: bundleId }).first();
    if (!bundle) return res.status(404).json({ success: false, message: "Bundle not found" });
    const amountNaira = Math.round(Number(bundle.price_ngn));
    if (!Number.isFinite(amountNaira) || amountNaira < MIN_FLUTTERWAVE_CHECKOUT_NGN) {
      return res.status(400).json({
        success: false,
        message: `Bundle NGN price is invalid (must be at least ₦${MIN_FLUTTERWAVE_CHECKOUT_NGN})`,
      });
    }

    const user = await db("users").where({ id: userId }).first();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const smartWallet = String(user.smart_wallet_address || "").trim();
    if (!smartWallet || smartWallet === "0x0000000000000000000000000000000000000000") {
      return res.status(400).json({ success: false, message: "No smart wallet. Create one in Profile first." });
    }
    const email = user.email || (user.username ? `${user.username}@tycoon.placeholder` : null);
    if (!email) return res.status(400).json({ success: false, message: "Email required for payment" });

    const redirectUrl = resolveShopFlutterwaveRedirect(_req.body?.callback_url);
    if (!redirectUrl.startsWith("http")) {
      return res.status(400).json({
        success: false,
        message:
          "Could not build redirect_url. Pass callback_url (https://your-domain/game-shop) from the app, or set FRONTEND_URL to your public https origin.",
      });
    }

    const txRef = `tycoon_bundle_${userId}_${bundleId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const { link, tx_ref } = await initializePayment({
      amountNaira,
      email,
      txRef,
      redirectUrl,
      meta: { user_id: String(userId), bundle_id: String(bundleId), product: "perk_bundle", wallet: smartWallet },
      customerName: user.username || "Tycoon User",
      customizations: {
        title: "Tycoon - Perk Bundle",
        description: "Pay in Naira and receive your bundle in your Tycoon smart wallet.",
      },
    });
    const ref = tx_ref || txRef;
    await db("flutterwave_payments").insert({
      tx_ref: ref,
      user_id: userId,
      bundle_id: bundleId,
      amount_kobo: Math.round(amountNaira * 100),
      amount_ngn: amountNaira,
      status: "pending",
    });
    return res.json({ success: true, link, reference: ref, tx_ref: ref });
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack }, "flutterwaveInitialize error");
    res.status(502).json({
      success: false,
      message: clientSafeErrorMessage(err, "Failed to initialize payment"),
    });
  }
}

/**
 * POST /api/shop/flutterwave/initialize-perk
 * Initialize a Flutterwave payment for perks
 */
export async function flutterwaveInitializePerk(_req, res) {
  try {
    if (!isFlutterwaveConfigured()) {
      return res.status(503).json({ success: false, message: "NGN payments not configured" });
    }
    const userId = _req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });

    const tokenId = String(_req.body?.token_id ?? _req.body?.tokenId ?? "").trim();
    const amountNairaRaw = Number(_req.body?.amount_ngn);
    const amountNaira = Number.isFinite(amountNairaRaw)
      ? Math.max(MIN_FLUTTERWAVE_CHECKOUT_NGN, Math.round(amountNairaRaw))
      : NaN;
    if (!tokenId) return res.status(400).json({ success: false, message: "token_id is required" });
    if (!Number.isFinite(amountNaira)) return res.status(400).json({ success: false, message: "Valid amount_ngn is required" });

    const user = await db("users").where({ id: userId }).first();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const smartWallet = String(user.smart_wallet_address || "").trim();
    if (!smartWallet || smartWallet === "0x0000000000000000000000000000000000000000") {
      return res.status(400).json({ success: false, message: "No smart wallet. Create one in Profile first." });
    }
    const email = user.email || (user.username ? `${user.username}@tycoon.placeholder` : null);
    if (!email) return res.status(400).json({ success: false, message: "Email required for payment" });

    const redirectUrl = resolveShopFlutterwaveRedirect(_req.body?.callback_url);
    if (!redirectUrl.startsWith("http")) {
      return res.status(400).json({
        success: false,
        message:
          "Could not build redirect_url. Pass callback_url (https://your-domain/game-shop) from the app, or set FRONTEND_URL to your public https origin.",
      });
    }

    const txRef = `tycoon_perk_${userId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const { link, tx_ref } = await initializePayment({
      amountNaira,
      email,
      txRef,
      redirectUrl,
      meta: { user_id: String(userId), token_id: tokenId, product: "perk_item", wallet: smartWallet },
      customerName: user.username || "Tycoon User",
      customizations: {
        title: "Tycoon - Perk Purchase",
        description: "Pay in Naira and receive your perk in your Tycoon smart wallet.",
      },
    });
    const ref = tx_ref || txRef;
    await db("flutterwave_perk_payments").insert({
      tx_ref: ref,
      user_id: userId,
      token_id: tokenId,
      amount_kobo: Math.round(amountNaira * 100),
      amount_ngn: amountNaira,
      status: "pending",
    });
    return res.json({ success: true, link, reference: ref, tx_ref: ref });
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack }, "flutterwaveInitializePerk error");
    res.status(502).json({
      success: false,
      message: clientSafeErrorMessage(err, "Failed to initialize perk payment"),
    });
  }
}

/**
 * GET /api/shop/flutterwave/verify
 * Verify a Flutterwave payment
 */
export async function flutterwaveVerify(_req, res) {
  try {
    const reference = String(_req.query?.reference || "").trim();
    if (!reference) return res.status(400).json({ success: false, message: "reference query required" });

    let source = "bundle";
    let row = await db("flutterwave_payments").where({ tx_ref: reference }).first();
    if (!row) {
      source = "perk";
      row = await db("flutterwave_perk_payments").where({ tx_ref: reference }).first();
    }
    if (!row) return res.json({ success: true, found: false, reference, fulfilled: false, status: null });

    // Lazy verification fallback in case webhook hasn't arrived yet.
    if (row.status !== "completed") {
      try {
        const remote = await verifyTransactionByReference(reference);
        if (remote && String(remote.status).toLowerCase() === "successful" && String(remote.currency).toUpperCase() === "NGN") {
          await fulfillFlutterwavePayment(reference, source, "verify");
          row = source === "bundle"
            ? await db("flutterwave_payments").where({ tx_ref: reference }).first()
            : await db("flutterwave_perk_payments").where({ tx_ref: reference }).first();
        } else if (remote && String(remote.status).toLowerCase() !== "successful") {
          await (source === "bundle" ? db("flutterwave_payments") : db("flutterwave_perk_payments"))
            .where({ tx_ref: reference, status: "pending" })
            .update({ status: "failed", updated_at: db.fn.now() });
          row.status = "failed";
        }
      } catch (err) {
        logger.warn({ err: err?.message, reference }, "flutterwaveVerify remote verification failed");
      }
    }

    return res.json({
      success: true,
      found: true,
      reference,
      status: row.status,
      fulfilled: row.status === "completed",
      source,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "flutterwaveVerify error");
    res.status(500).json({ success: false, message: "Failed to verify payment" });
  }
}

/**
 * POST /api/shop/flutterwave/webhook
 * Receive Flutterwave webhook events
 */
export async function flutterwaveWebhook(_req, res) {
  try {
    const headerSig = _req.headers["verif-hash"] || _req.headers["Verif-Hash"];
    const hasExpectedSig = Boolean(process.env.FLW_SECRET_HASH);
    if (hasExpectedSig && !verifyWebhookSignature(String(headerSig || ""))) {
      return res.status(401).json({ success: false, message: "Invalid webhook signature" });
    }

    const event = String(_req.body?.event || "").toLowerCase();
    const data = _req.body?.data || {};
    const txRef = String(data?.tx_ref || "").trim();
    const txId = Number(data?.id);
    const status = String(data?.status || "").toLowerCase();
    const currency = String(data?.currency || "").toUpperCase();
    if (!txRef) return res.json({ success: true, ignored: true, reason: "no-tx-ref" });

    // Double-check transaction with Flutterwave API when tx id exists.
    let verified = null;
    if (Number.isFinite(txId) && txId > 0) {
      try { verified = await verifyTransactionById(txId); } catch (_) {}
    }
    const effectiveStatus = String(verified?.status || status).toLowerCase();
    const effectiveCurrency = String(verified?.currency || currency).toUpperCase();
    if (effectiveCurrency && effectiveCurrency !== "NGN") {
      return res.json({ success: true, ignored: true, reason: "non-ngn" });
    }

    let source = "bundle";
    let row = await db("flutterwave_payments").where({ tx_ref: txRef }).first();
    if (!row) {
      source = "perk";
      row = await db("flutterwave_perk_payments").where({ tx_ref: txRef }).first();
    }
    if (!row) return res.json({ success: true, ignored: true, reason: "unknown-reference" });

    if (event === "charge.completed" && effectiveStatus === "successful") {
      await fulfillFlutterwavePayment(txRef, source, "webhook");
      return res.json({ success: true, fulfilled: true, reference: txRef, source });
    }

    if (effectiveStatus && effectiveStatus !== "successful") {
      await (source === "bundle" ? db("flutterwave_payments") : db("flutterwave_perk_payments"))
        .where({ tx_ref: txRef, status: "pending" })
        .update({ status: "failed", updated_at: db.fn.now() });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err: err?.message }, "flutterwaveWebhook error");
    res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
}

async function fulfillFlutterwavePayment(txRef, source, trigger) {
  const table = source === "perk" ? "flutterwave_perk_payments" : "flutterwave_payments";
  const row = await db(table).where({ tx_ref: txRef }).first();
  if (!row) return false;
  if (row.status === "completed" && row.fulfilled_at) return true;

  const user = await db("users").where({ id: row.user_id }).first();
  const smartWallet = String(user?.smart_wallet_address || "").trim();
  if (!smartWallet || smartWallet === "0x0000000000000000000000000000000000000000") {
    await db(table).where({ tx_ref: txRef, status: "pending" }).update({ status: "failed", updated_at: db.fn.now() });
    throw new Error("User has no smart wallet for fulfillment");
  }

  if (source === "perk") {
    await deliverCollectibleToUser(smartWallet, row.token_id, "CELO");
  } else {
    await deliverBundleToUser(smartWallet, row.bundle_id, "CELO");
  }

  await db(table)
    .where({ tx_ref: txRef })
    .update({ status: "completed", fulfilled_at: db.fn.now(), updated_at: db.fn.now() });
  logger.info({ txRef, source, userId: row.user_id, smartWallet, trigger }, "Flutterwave payment fulfilled to smart wallet");
  return true;
}
