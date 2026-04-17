import db from "../config/database.js";
import logger from "../config/logger.js";
import { attachReferralByCode, ensureUserReferralCode } from "../services/referralService.js";
import { monthUtcBounds, parseYearMonth } from "../utils/leaderboardMonth.js";

/**
 * GET /api/referral/leaderboard?limit=20&month=YYYY-MM
 * Public: top accounts by direct referral count (users who completed signup with their code).
 * Optional month= filters referee.referred_at to that UTC calendar month (default: all-time).
 */
export async function getPublicLeaderboard(req, res) {
  try {
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 100);
    const monthRaw = req.query.month != null && String(req.query.month).trim() !== "" ? String(req.query.month).trim() : null;
    const { start, end } = monthRaw ? monthUtcBounds(parseYearMonth(monthRaw)) : null;

    let q = db("users as referee")
      .join("users as referrer", "referee.referred_by_user_id", "referrer.id")
      .where("referrer.is_guest", false)
      .andWhereRaw("referrer.username NOT LIKE ?", ["%AI_%"]);

    if (start && end) {
      q = q.where("referee.referred_at", ">=", start).where("referee.referred_at", "<", end);
    }

    const rows = await q
      .select("referrer.id as id", "referrer.username as username")
      .count("referee.id as referral_count")
      .groupBy("referrer.id", "referrer.username")
      .orderBy("referral_count", "desc")
      .orderBy("referrer.username", "asc")
      .limit(limit);

    const data = (rows || []).map((row) => ({
      id: Number(row.id),
      username: row.username ?? "—",
      referral_count: Number(row.referral_count ?? 0),
    }));

    res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, "referral getPublicLeaderboard error");
    res.status(500).json({ success: false, message: "Failed to load referral leaderboard" });
  }
}

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
