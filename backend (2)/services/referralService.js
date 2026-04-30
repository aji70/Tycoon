import crypto from "crypto";
import db from "../config/database.js";
import logger from "../config/logger.js";

/**
 * Unique referral_code for new users (lowercase hex prefix).
 */
export async function generateUniqueReferralCode() {
  for (let attempt = 0; attempt < 25; attempt++) {
    const code = `t${crypto.randomBytes(5).toString("hex")}`;
    const exists = await db("users").where({ referral_code: code }).first("id");
    if (!exists) return code;
  }
  throw new Error("Could not allocate referral_code");
}

function normalizeReferralCodeInput(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s || s.length > 32) return null;
  if (!/^[a-z0-9]+$/.test(s)) return null;
  return s;
}

function normalizeSource(raw) {
  if (raw === "api" || raw === "privy_signin") return raw;
  return "unknown";
}

async function tryInsertReferralEvent(row) {
  try {
    await db("referral_events").insert(row);
  } catch (err) {
    const missing =
      err.errno === 1146 ||
      err.code === "ER_NO_SUCH_TABLE" ||
      (typeof err.message === "string" && err.message.includes("doesn't exist"));
    if (missing) {
      logger.debug("referral_events table missing; skipping event log");
      return;
    }
    logger.warn({ err }, "referral_events insert failed");
  }
}

/**
 * Idempotent attach: only if user has no referred_by yet.
 * @param {object} [opts]
 * @param {"api"|"privy_signin"|"unknown"} [opts.source] — used for referral_events.source
 * @returns {{ ok: true, referrerUserId: number } | { ok: false, error: string }}
 */
export async function attachReferralByCode(userId, rawCode, opts = {}) {
  const source = normalizeSource(opts.source);

  const logEvent = async (partial) => {
    await tryInsertReferralEvent({
      referee_user_id: Number(userId),
      event_type: partial.eventType,
      referrer_user_id: partial.referrerUserId ?? null,
      code_normalized: partial.codeNormalized ?? null,
      failure_reason: partial.failureReason ?? null,
      source,
      metadata: partial.metadata ?? null,
    });
  };

  const code = normalizeReferralCodeInput(rawCode);
  if (!code) {
    await logEvent({ eventType: "attach_failed", failureReason: "invalid_code" });
    return { ok: false, error: "invalid_code" };
  }

  const user = await db("users").where({ id: userId }).first("id", "referred_by_user_id");
  if (!user) {
    await logEvent({ eventType: "attach_failed", codeNormalized: code, failureReason: "user_not_found" });
    return { ok: false, error: "user_not_found" };
  }
  if (user.referred_by_user_id != null) {
    await logEvent({ eventType: "attach_failed", codeNormalized: code, failureReason: "already_referred" });
    return { ok: false, error: "already_referred" };
  }

  const referrer = await db("users").where({ referral_code: code }).first("id");
  if (!referrer) {
    await logEvent({ eventType: "attach_failed", codeNormalized: code, failureReason: "code_not_found" });
    return { ok: false, error: "code_not_found" };
  }
  if (Number(referrer.id) === Number(userId)) {
    await logEvent({
      eventType: "attach_failed",
      codeNormalized: code,
      failureReason: "self_referral",
      referrerUserId: referrer.id,
    });
    return { ok: false, error: "self_referral" };
  }

  const updated = await db("users").where({ id: userId }).whereNull("referred_by_user_id").update({
    referred_by_user_id: referrer.id,
    referred_at: db.fn.now(),
  });
  if (!updated) {
    await logEvent({ eventType: "attach_failed", codeNormalized: code, failureReason: "already_referred" });
    return { ok: false, error: "already_referred" };
  }

  await logEvent({
    eventType: "attach_success",
    codeNormalized: code,
    referrerUserId: referrer.id,
  });

  logger.info({ userId, referrerUserId: referrer.id }, "referral attached");
  return { ok: true, referrerUserId: referrer.id };
}

/**
 * Ensure legacy row has referral_code (lazy repair if migration missed).
 */
export async function ensureUserReferralCode(userId) {
  const row = await db("users").where({ id: userId }).first("id", "referral_code");
  if (!row) return null;
  if (row.referral_code) return row.referral_code;
  const code = await generateUniqueReferralCode();
  try {
    await db("users").where({ id: userId }).whereNull("referral_code").update({ referral_code: code });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") {
      const again = await db("users").where({ id: userId }).first("referral_code");
      return again?.referral_code ?? null;
    }
    throw e;
  }
  return code;
}
