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

/**
 * Idempotent attach: only if user has no referred_by yet.
 * @returns {{ ok: true, referrerUserId: number } | { ok: false, error: string }}
 */
export async function attachReferralByCode(userId, rawCode) {
  const code = normalizeReferralCodeInput(rawCode);
  if (!code) {
    return { ok: false, error: "invalid_code" };
  }

  const user = await db("users").where({ id: userId }).first("id", "referred_by_user_id");
  if (!user) {
    return { ok: false, error: "user_not_found" };
  }
  if (user.referred_by_user_id != null) {
    return { ok: false, error: "already_referred" };
  }

  const referrer = await db("users").where({ referral_code: code }).first("id");
  if (!referrer) {
    return { ok: false, error: "code_not_found" };
  }
  if (Number(referrer.id) === Number(userId)) {
    return { ok: false, error: "self_referral" };
  }

  const updated = await db("users").where({ id: userId }).whereNull("referred_by_user_id").update({
    referred_by_user_id: referrer.id,
    referred_at: db.fn.now(),
  });
  if (!updated) {
    return { ok: false, error: "already_referred" };
  }

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
