/**
 * Shop: perk bundles (list; purchase via TYC/USDC on-chain or NGN via Paystack/Flutterwave).
 */
import db from "../config/database.js";
import {
  isPaystackConfigured,
  initializeTransaction,
  verifyWebhookSignature,
  verifyTransaction,
} from "../services/paystack.js";
import {
  isFlutterwaveConfigured,
  initializePayment,
  verifyWebhookSignature as verifyFlutterwaveWebhookSignature,
} from "../services/flutterwave.js";
import logger from "../config/logger.js";
import crypto from "crypto";

export async function listBundles(req, res) {
  try {
    const bundles = await db("perk_bundles")
      .where({ active: true })
      .orderBy("id", "asc")
      .select("id", "name", "description", "token_ids", "amounts", "price_tyc", "price_usdc", "price_ngn", "created_at");

    const ngnAvailable = isFlutterwaveConfigured() || isPaystackConfigured();
    return res.json({
      success: true,
      ngn_available: ngnAvailable,
      bundles: bundles.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        token_ids: b.token_ids,
        amounts: b.amounts,
        price_tyc: String(b.price_tyc ?? 0),
        price_usdc: String(b.price_usdc ?? 0),
        price_ngn: b.price_ngn != null ? Number(b.price_ngn) : null,
      })),
    });
  } catch (err) {
    console.error("listBundles error:", err);
    return res.status(500).json({ success: false, message: "Failed to list bundles" });
  }
}

/**
 * POST /api/shop/paystack/initialize
 * Body: { bundle_id, callback_url? }
 * Auth required. Creates Paystack transaction and returns authorization_url + reference.
 */
export async function paystackInitialize(req, res) {
  try {
    const user_id = req.user?.id;
    if (!user_id) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    if (!isPaystackConfigured()) {
      return res.status(503).json({ success: false, message: "NGN payments are not configured" });
    }

    const { bundle_id, callback_url } = req.body || {};
    const bundleId = bundle_id != null ? Number(bundle_id) : NaN;
    if (!Number.isInteger(bundleId) || bundleId < 1) {
      return res.status(400).json({ success: false, message: "Valid bundle_id is required" });
    }

    const bundle = await db("perk_bundles").where({ id: bundleId, active: true }).first();
    if (!bundle) {
      return res.status(404).json({ success: false, message: "Bundle not found or inactive" });
    }
    const priceNgn = bundle.price_ngn != null ? Number(bundle.price_ngn) : null;
    if (priceNgn == null || priceNgn < 1) {
      return res.status(400).json({ success: false, message: "This bundle is not available for NGN purchase" });
    }

    const user = await db("users").where({ id: user_id }).first();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const email = user.email || user.username ? `${user.username}@tycoon.placeholder` : null;
    if (!email) {
      return res.status(400).json({ success: false, message: "User must have an email for NGN payment" });
    }

    const reference = `bundle_${bundleId}_${user_id}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const amountKobo = Math.round(priceNgn * 100);
    const { authorization_url, reference: ref } = await initializeTransaction({
      amountKobo,
      email,
      reference,
      callbackUrl: callback_url || undefined,
      metadata: { user_id: String(user_id), bundle_id: String(bundleId) },
    });

    await db("paystack_payments").insert({
      reference: ref,
      user_id: user_id,
      bundle_id: bundleId,
      amount_kobo: amountKobo,
      status: "pending",
    });

    return res.json({
      success: true,
      authorization_url: authorization_url,
      reference: ref,
    });
  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, "paystackInitialize error");
    return res.status(500).json({ success: false, message: err.message || "Failed to initialize payment" });
  }
}

/**
 * POST /api/shop/paystack/webhook
 * Raw body required for signature verification. Respond 200 immediately; process async.
 */
export async function paystackWebhook(req, res) {
  const rawBody = req.body;
  const signature = req.headers["x-paystack-signature"];
  if (!rawBody || !signature) {
    return res.status(400).send("Bad request");
  }
  const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
  if (!verifyWebhookSignature(bodyStr, signature)) {
    logger.warn("Paystack webhook signature verification failed");
    return res.status(401).send("Invalid signature");
  }

  let event;
  try {
    event = JSON.parse(bodyStr);
  } catch (_) {
    return res.status(400).send("Invalid JSON");
  }

  res.status(200).send("OK");

  if (event.event !== "charge.success") {
    return;
  }

  const data = event.data;
  const reference = data?.reference;
  if (!reference) return;

  (async () => {
    try {
      const existing = await db("paystack_payments").where({ reference }).first();
          if (!existing) {
        logger.warn({ reference }, "Paystack webhook: unknown reference");
        return;
      }
          if (existing.status === "completed") {
        return;
      }

      const amountPaid = data.amount != null ? Number(data.amount) : 0;
      if (amountPaid < existing.amount_kobo) {
        logger.warn({ reference, amountPaid, expected: existing.amount_kobo }, "Paystack amount mismatch");
        await db("paystack_payments").where({ reference }).update({ status: "failed", updated_at: new Date() });
        return;
      }

      await db("paystack_payments").where({ reference }).update({
        status: "completed",
        fulfilled_at: new Date(),
        updated_at: new Date(),
      });

      await db("user_bundle_purchases").insert({
        user_id: existing.user_id,
        bundle_id: existing.bundle_id,
        payment_reference: reference,
        source: "ngn",
      });

      logger.info(
        { reference, user_id: existing.user_id, bundle_id: existing.bundle_id },
        "Paystack payment fulfilled"
      );
    } catch (err) {
      logger.error({ err: err.message, reference }, "Paystack webhook fulfillment error");
    }
  })();
}

/**
 * GET /api/shop/paystack/verify?reference=xxx
 * Returns payment and fulfillment status for the given reference (for redirect page / polling).
 */
export async function paystackVerify(req, res) {
  try {
    const reference = req.query?.reference;
    if (!reference || typeof reference !== "string") {
      return res.status(400).json({ success: false, message: "reference query is required" });
    }

    const row = await db("paystack_payments")
      .where({ reference })
      .select("reference", "user_id", "bundle_id", "status", "fulfilled_at", "created_at")
      .first();

    if (!row) {
      return res.json({
        success: true,
        found: false,
        reference,
        status: null,
        fulfilled: false,
      });
    }

    const isOwn = req.user && Number(req.user.id) === Number(row.user_id);
    return res.json({
      success: true,
      found: true,
      reference: row.reference,
      status: row.status,
      fulfilled: Boolean(row.fulfilled_at),
      fulfilled_at: row.fulfilled_at,
      bundle_id: row.bundle_id,
      user_id: isOwn ? row.user_id : undefined,
    });
  } catch (err) {
    logger.error({ err: err.message }, "paystackVerify error");
    return res.status(500).json({ success: false, message: "Verification failed" });
  }
}

// ─── Flutterwave (NGN) ─────────────────────────────────────────────────────

/**
 * POST /api/shop/flutterwave/initialize
 * Body: { bundle_id, callback_url? }
 * Auth required. Creates Flutterwave payment and returns link + tx_ref.
 */
export async function flutterwaveInitialize(req, res) {
  try {
    const user_id = req.user?.id;
    if (!user_id) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    if (!isFlutterwaveConfigured()) {
      return res.status(503).json({ success: false, message: "NGN payments (Flutterwave) are not configured" });
    }

    const { bundle_id, callback_url } = req.body || {};
    const bundleId = bundle_id != null ? Number(bundle_id) : NaN;
    if (!Number.isInteger(bundleId) || bundleId < 1) {
      return res.status(400).json({ success: false, message: "Valid bundle_id is required" });
    }

    const bundle = await db("perk_bundles").where({ id: bundleId, active: true }).first();
    if (!bundle) {
      return res.status(404).json({ success: false, message: "Bundle not found or inactive" });
    }
    const priceNgn = bundle.price_ngn != null ? Number(bundle.price_ngn) : null;
    if (priceNgn == null || priceNgn < 1) {
      return res.status(400).json({ success: false, message: "This bundle is not available for NGN purchase" });
    }

    const user = await db("users").where({ id: user_id }).first();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const email = user.email || (user.username ? `${user.username}@tycoon.placeholder` : null);

    const txRef = `tycoon_bundle_${bundleId}_${user_id}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    let redirectUrl = (callback_url && String(callback_url).trim()) || "";
    if (!redirectUrl.startsWith("http")) {
      const base = (process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || "").replace(/\/$/, "");
      redirectUrl = base ? `${base}/game-shop` : "";
    }
    if (!redirectUrl || !redirectUrl.startsWith("http")) {
      return res.status(400).json({ success: false, message: "callback_url or FRONTEND_URL is required for NGN payment redirect" });
    }
    const { link, tx_ref } = await initializePayment({
      amountNaira: priceNgn,
      email,
      txRef,
      redirectUrl,
      meta: { user_id: String(user_id), bundle_id: String(bundleId) },
      customerName: user.username || user.email || undefined,
    });

    // Store amount in kobo (priceNgn * 100) for flutterwave_payments; webhook uses amount_ngn ?? amount_kobo/100
    await db("flutterwave_payments").insert({
      tx_ref,
      user_id,
      bundle_id: bundleId,
      amount_kobo: Math.round(priceNgn * 100),
      status: "pending",
    });

    return res.json({
      success: true,
      link,
      reference: tx_ref,
    });
  } catch (err) {
    logger.error(
      { err: err.message, stack: err.stack, userId: req.user?.id },
      "flutterwaveInitialize error"
    );
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to initialize payment",
    });
  }
}

/**
 * POST /api/shop/flutterwave/webhook
 * Raw body required. Verifies verif-hash, then processes charge.completed.
 */
export async function flutterwaveWebhook(req, res) {
  const signature = req.headers["verif-hash"];
  if (!verifyFlutterwaveWebhookSignature(signature)) {
    logger.warn("Flutterwave webhook signature verification failed");
    return res.status(401).send("Invalid signature");
  }

  let payload;
  try {
    payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (_) {
    return res.status(400).send("Invalid JSON");
  }

  res.status(200).send("OK");

  if (payload.event !== "charge.completed") {
    return;
  }

  const data = payload.data;
  const txRef = data?.tx_ref;
  const status = data?.status;
  if (!txRef || status !== "successful") return;

  (async () => {
    try {
      const existing = await db("flutterwave_payments").where({ tx_ref: txRef }).first();
      if (!existing) {
        logger.warn({ tx_ref: txRef }, "Flutterwave webhook: unknown reference");
        return;
      }
      if (existing.status === "completed") return;

      const amountPaid = data.amount != null ? Number(data.amount) : 0;
      const expectedNaira = existing.amount_ngn != null ? Number(existing.amount_ngn) : Math.round(Number(existing.amount_kobo || 0) / 100);
      if (amountPaid < expectedNaira) {
        logger.warn({ tx_ref: txRef, amountPaid, expected: expectedNaira }, "Flutterwave amount mismatch");
        await db("flutterwave_payments").where({ tx_ref: txRef }).update({ status: "failed", updated_at: new Date() });
        return;
      }

      await db("flutterwave_payments").where({ tx_ref: txRef }).update({
        status: "completed",
        fulfilled_at: new Date(),
        updated_at: new Date(),
      });

      await db("user_bundle_purchases").insert({
        user_id: existing.user_id,
        bundle_id: existing.bundle_id,
        payment_reference: txRef,
        source: "ngn",
      });

      logger.info(
        { tx_ref: txRef, user_id: existing.user_id, bundle_id: existing.bundle_id },
        "Flutterwave payment fulfilled"
      );
    } catch (err) {
      logger.error({ err: err.message, tx_ref: txRef }, "Flutterwave webhook fulfillment error");
    }
  })();
}

/**
 * GET /api/shop/flutterwave/verify?reference=xxx
 * Returns payment and fulfillment status for the given tx_ref (for redirect page / polling).
 */
export async function flutterwaveVerify(req, res) {
  try {
    const reference = req.query?.reference;
    if (!reference || typeof reference !== "string") {
      return res.status(400).json({ success: false, message: "reference query is required" });
    }

    const row = await db("flutterwave_payments")
      .where({ tx_ref: reference })
      .select("tx_ref", "user_id", "bundle_id", "status", "fulfilled_at", "created_at")
      .first();

    if (!row) {
      return res.json({
        success: true,
        found: false,
        reference,
        status: null,
        fulfilled: false,
      });
    }

    const isOwn = req.user && Number(req.user.id) === Number(row.user_id);
    return res.json({
      success: true,
      found: true,
      reference: row.tx_ref,
      status: row.status,
      fulfilled: Boolean(row.fulfilled_at),
      fulfilled_at: row.fulfilled_at,
      bundle_id: row.bundle_id,
      user_id: isOwn ? row.user_id : undefined,
    });
  } catch (err) {
    logger.error({ err: err.message }, "flutterwaveVerify error");
    return res.status(500).json({ success: false, message: "Verification failed" });
  }
}
