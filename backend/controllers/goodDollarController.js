import db from "../config/database.js";
import logger from "../config/logger.js";
import {
  getUserGoodDollarVerificationDetail,
  isGoodDollarIdentityEnabled,
  isGoodDollarPlayGateExempt,
} from "../services/goodDollarIdentity.js";
import { isGoodDollarPlayOpenToAll } from "../services/platformSettings.js";
import { recordEvent } from "../services/analytics.js";

const TRACK_EVENTS = new Set(["fv_started", "fv_returned", "fv_confirmed"]);

/**
 * GET /api/gooddollar/status
 * Returns the same verification bit the MiniPay play gate uses, plus the
 * addresses that were checked so the UI can show which wallet was tested.
 * Auth required (requireAuthOrWallet) — mounted in server.js.
 *
 * Side effect: when the user is on-chain verified and gd_verified_at is empty,
 * stamp it and emit analytics so we can count verifications seen via Tycoon.
 */
export async function goodDollarStatus(req, res) {
  try {
    const user_id = req.user?.id;
    if (!user_id) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const user = await db("users").where({ id: user_id }).first();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const enabled = isGoodDollarIdentityEnabled();
    const { verified, checkedAddresses } = await getUserGoodDollarVerificationDetail(user);
    const playGateExempt = isGoodDollarPlayGateExempt(user);
    const playOpenToAll = await isGoodDollarPlayOpenToAll();

    let gdVerifiedAt = user.gd_verified_at || null;
    if (verified && !gdVerifiedAt) {
      const now = new Date();
      try {
        await db("users").where({ id: user_id }).update({ gd_verified_at: now });
        gdVerifiedAt = now;
        await recordEvent("gd_verified_confirmed", {
          entityType: "user",
          entityId: Number(user_id),
          payload: {
            source: "status_poll",
            checkedAddresses,
            address: checkedAddresses[0] || null,
          },
        });
      } catch (stampErr) {
        logger.warn({ err: stampErr?.message, user_id }, "gd_verified_at stamp failed");
      }
    }

    return res.json({
      success: true,
      enabled,
      verified,
      gd_verified_at: gdVerifiedAt,
      gd_fv_started_at: user.gd_fv_started_at || null,
      /** Ops / allowlisted wallets may create games + Arena without G$ (not daily claim). */
      play_gate_exempt: playGateExempt,
      /** Admin toggle: everyone may create games / Arena without G$ (not daily claim). */
      play_open_to_all: playOpenToAll,
      checkedAddresses,
      verifyUrl: "https://goodid.gooddollar.org/",
    });
  } catch (err) {
    logger.error({ err: err?.message }, "goodDollarStatus error");
    return res.status(500).json({ success: false, message: "Failed to get GoodDollar status" });
  }
}

/**
 * POST /api/gooddollar/track
 * Body: { event: 'fv_started'|'fv_returned'|'fv_confirmed', source?, address?, isVerified?, reason? }
 * Best-effort analytics for Face Verify flows started from Tycoon / MiniPay.
 */
export async function goodDollarTrack(req, res) {
  try {
    const user_id = req.user?.id;
    if (!user_id) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const event = String(req.body?.event || "").trim();
    if (!TRACK_EVENTS.has(event)) {
      return res.status(400).json({ success: false, message: "Invalid event" });
    }

    const source = String(req.body?.source || "minipay").slice(0, 64);
    const address =
      typeof req.body?.address === "string" && /^0x[a-fA-F0-9]{40}$/.test(req.body.address.trim())
        ? req.body.address.trim()
        : null;
    const isVerified =
      req.body?.isVerified === true ||
      req.body?.isVerified === "true" ||
      req.body?.isVerified === 1 ||
      req.body?.isVerified === "1";
    const reason =
      typeof req.body?.reason === "string" ? String(req.body.reason).slice(0, 500) : null;

    const patch = {};
    if (event === "fv_started") {
      patch.gd_fv_started_at = db.raw("COALESCE(gd_fv_started_at, NOW())");
    }
    if ((event === "fv_returned" && isVerified) || event === "fv_confirmed") {
      patch.gd_verified_at = db.raw("COALESCE(gd_verified_at, NOW())");
    }
    if (Object.keys(patch).length > 0) {
      try {
        await db("users").where({ id: user_id }).update(patch);
      } catch (updErr) {
        logger.warn({ err: updErr?.message, user_id, event }, "goodDollarTrack user stamp failed");
      }
    }

    await recordEvent(`gd_${event}`, {
      entityType: "user",
      entityId: Number(user_id),
      payload: { source, address, isVerified: Boolean(isVerified), reason },
    });

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err: err?.message }, "goodDollarTrack error");
    return res.status(500).json({ success: false, message: "Failed to track event" });
  }
}
