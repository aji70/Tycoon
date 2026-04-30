/**
 * Hosted agent credits: balance, purchase (USDC / NGN).
 * Pricing: $1 USDC = 100 credits, 1000 NGN = 100 credits.
 */

import db from "../config/database.js";
import User from "../models/User.js";
import * as hostedAgentCredits from "../services/hostedAgentCredits.js";
import { verifyUsdcTransfer, isUsdcCreditsConfigured } from "../services/verifyUsdcTransfer.js";
import { isFlutterwaveConfigured, initializePayment } from "../services/flutterwave.js";
import logger from "../config/logger.js";
import crypto from "crypto";

/** GET /api/agents/hosted-credits — returns balance + daily free tier info */
export async function getCredits(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });

    const { getCredits: getDailyCredits } = await import("../services/hostedAgentUsage.js");
    const balance = await hostedAgentCredits.getBalance(userId);
    const daily = await getDailyCredits(userId);

    const data = {
      balance,
      daily: { used: daily.used, cap: daily.cap, remaining: daily.remaining },
      purchase_usdc_available: isUsdcCreditsConfigured(),
      purchase_ngn_available: isFlutterwaveConfigured(),
      credits_per_usdc: hostedAgentCredits.CREDITS_FOR_1_USDC,
      credits_per_1000_ngn: hostedAgentCredits.CREDITS_PER_1000_NGN,
    };
    if (isUsdcCreditsConfigured()) {
      data.usdc_recipient = process.env.HOSTED_AGENT_CREDITS_USDC_RECIPIENT || null;
    }
    return res.json({ success: true, data });
  } catch (err) {
    logger.error({ err: err.message }, "getCredits error");
    return res.status(500).json({ success: false, message: err?.message || "Failed to get credits" });
  }
}

/** POST /api/agents/hosted-credits/purchase/usdc — verify tx and credit */
export async function purchaseUsdc(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });
    if (!isUsdcCreditsConfigured()) {
      return res.status(503).json({ success: false, message: "USDC credits purchase not configured" });
    }

    const { tx_hash } = req.body || {};
    if (!tx_hash) return res.status(400).json({ success: false, message: "tx_hash required" });

    const txHash = String(tx_hash).trim();

    // Atomic claim: only one concurrent call for the same tx_hash proceeds
    const credits = hostedAgentCredits.CREDITS_FOR_1_USDC;
    const claimed = await db("hosted_agent_credit_purchases")
      .where({ tx_hash: txHash })
      .first();
    if (claimed) {
      const balance = await hostedAgentCredits.getBalance(userId);
      return res.json({ success: true, already_credited: true, balance });
    }

    const result = await verifyUsdcTransfer(txHash);
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.error || "Invalid transaction" });
    }

    const senderUser = result.from ? await User.resolveUserByAddress(result.from, "CELO") : null;
    if (!senderUser || Number(senderUser.id) !== Number(userId)) {
      return res.status(400).json({
        success: false,
        message: "Transaction was sent from a different wallet. Sign in with the wallet that sent the USDC.",
      });
    }

    const { balance } = await hostedAgentCredits.addCredits(userId, credits, {
      source: "usdc",
      price_usdc: 1,
      tx_hash: txHash,
    });

    return res.json({ success: true, credits, balance });
  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, "purchaseUsdc error");
    return res.status(500).json({ success: false, message: err?.message || "Purchase failed" });
  }
}

/** POST /api/agents/hosted-credits/purchase/ngn/initialize — start NGN purchase via Flutterwave */
export async function purchaseNgnInitialize(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });
    if (!isFlutterwaveConfigured()) {
      return res.status(503).json({ success: false, message: "NGN payments not configured" });
    }

    const { callback_url } = req.body || {};
    const amountNaira = hostedAgentCredits.NGN_PRICE_PER_100_CREDITS;
    const credits = hostedAgentCredits.CREDITS_PER_1000_NGN;

    const user = await db("users").where({ id: userId }).first();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const email = user.email || (user.username ? `${user.username}@tycoon.placeholder` : null);
    if (!email) return res.status(400).json({ success: false, message: "Email required for NGN payment" });

    let redirectUrl = (callback_url && String(callback_url).trim()) || "";
    if (!redirectUrl.startsWith("http")) {
      const base = (process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || "").replace(/\/$/, "");
      redirectUrl = base ? `${base}/agents` : "";
    }
    if (!redirectUrl.startsWith("http")) {
      return res.status(400).json({ success: false, message: "callback_url or FRONTEND_URL required" });
    }

    const txRef = `tycoon_credits_${userId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const { link, tx_ref } = await initializePayment({
      amountNaira,
      email,
      txRef,
      redirectUrl,
      meta: { user_id: String(userId), product: "hosted_agent_credits", credits: String(credits) },
      customerName: user.username || "Tycoon User",
    });

    const ref = tx_ref || txRef;
    await db("hosted_agent_credits_ngn_pending").insert({
      tx_ref: ref,
      user_id: userId,
      credits,
      amount_ngn: amountNaira,
      status: "pending",
    });

    return res.json({
      success: true,
      link,
      reference: ref,
      amount_ngn: amountNaira,
      credits,
    });
  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, "purchaseNgnInitialize error");
    return res.status(500).json({ success: false, message: err?.message || "Failed to initialize" });
  }
}

/** GET /api/agents/hosted-credits/purchase/ngn/verify?reference=xxx */
export async function purchaseNgnVerify(req, res) {
  try {
    const reference = req.query?.reference;
    if (!reference || typeof reference !== "string") {
      return res.status(400).json({ success: false, message: "reference query required" });
    }
    const row = await db("hosted_agent_credits_ngn_pending")
      .where({ tx_ref: reference })
      .select("tx_ref", "user_id", "credits", "amount_ngn", "status", "created_at", "updated_at")
      .first();

    if (!row) {
      return res.json({ success: true, found: false, reference, status: null, fulfilled: false });
    }

    const isOwn = req.user && Number(req.user.id) === Number(row.user_id);
    return res.json({
      success: true,
      found: true,
      reference: row.tx_ref,
      status: row.status,
      fulfilled: row.status === "completed",
      credits: isOwn ? row.credits : undefined,
      user_id: isOwn ? row.user_id : undefined,
    });
  } catch (err) {
    logger.error({ err: err.message }, "purchaseNgnVerify error");
    return res.status(500).json({ success: false, message: "Verification failed" });
  }
}
