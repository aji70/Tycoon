import db from "../config/database.js";
import logger from "../config/logger.js";
import { attachReferralByCode, ensureUserReferralCode } from "../services/referralService.js";

/**
 * GET /api/referral/me
 * Auth: Bearer JWT
 */
export async function getMe(req, res) {
  try {
    const userId = req.userId;
    await ensureUserReferralCode(userId);
    const user = await db("users")
      .where({ id: userId })
      .first("id", "username", "referral_code", "referred_by_user_id", "referred_at");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const countRow = await db("users").where({ referred_by_user_id: userId }).count("* as c").first();
    const directReferrals = Number(countRow?.c ?? 0);

    let referredByUsername = null;
    if (user.referred_by_user_id) {
      const ref = await db("users").where({ id: user.referred_by_user_id }).first("username");
      referredByUsername = ref?.username ?? null;
    }

    const code = user.referral_code;
    res.json({
      success: true,
      data: {
        referralCode: code,
        directReferralsCount: directReferrals,
        referredByUserId: user.referred_by_user_id,
        referredByUsername,
        referredAt: user.referred_at,
        shareQuery: code ? `ref=${code}` : null,
      },
    });
  } catch (err) {
    logger.error({ err }, "referral getMe error");
    res.status(500).json({ success: false, message: "Failed to load referral info" });
  }
}

/**
 * POST /api/referral/attach
 * Body: { code } | { referralCode } | { ref }
 * Auth: Bearer JWT
 */
export async function attach(req, res) {
  try {
    const raw = req.body?.code ?? req.body?.referralCode ?? req.body?.referral_code ?? req.body?.ref;
    const result = await attachReferralByCode(req.userId, raw, { source: "api" });

    if (!result.ok) {
      const status =
        result.error === "user_not_found"
          ? 404
          : result.error === "invalid_code"
            ? 400
            : result.error === "code_not_found"
              ? 404
              : result.error === "self_referral"
                ? 400
                : 409;
      return res.status(status).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      data: { referrerUserId: result.referrerUserId },
    });
  } catch (err) {
    logger.error({ err }, "referral attach error");
    res.status(500).json({ success: false, message: "Attach failed" });
  }
}
