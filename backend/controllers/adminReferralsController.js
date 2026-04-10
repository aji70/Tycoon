import db from "../config/database.js";
import logger from "../config/logger.js";

/**
 * GET /api/admin/referrals/overview
 */
export async function getOverview(req, res) {
  try {
    const [totalUsersRow, withCodeRow, referredRow] = await Promise.all([
      db("users").count("* as c").first(),
      db("users").whereNotNull("referral_code").count("* as c").first(),
      db("users").whereNotNull("referred_by_user_id").count("* as c").first(),
    ]);

    const topReferrers = await db("users as referee")
      .join("users as referrer", "referee.referred_by_user_id", "referrer.id")
      .select(
        "referrer.id as referrerUserId",
        "referrer.username as referrerUsername",
        "referrer.referral_code as referrerCode"
      )
      .count("referee.id as referralCount")
      .groupBy("referrer.id", "referrer.username", "referrer.referral_code")
      .orderBy("referralCount", "desc")
      .limit(20);

    const recent = await db("users as u")
      .leftJoin("users as r", "u.referred_by_user_id", "r.id")
      .whereNotNull("u.referred_by_user_id")
      .select(
        "u.id as userId",
        "u.username",
        "u.referred_at as referredAt",
        "r.id as referrerUserId",
        "r.username as referrerUsername",
        "r.referral_code as referrerCode"
      )
      .orderBy("u.referred_at", "desc")
      .limit(25);

    res.json({
      success: true,
      data: {
        totals: {
          users: Number(totalUsersRow?.c ?? 0),
          withReferralCode: Number(withCodeRow?.c ?? 0),
          referredUsers: Number(referredRow?.c ?? 0),
        },
        topReferrers: topReferrers.map((row) => ({
          referrerUserId: row.referrerUserId,
          referrerUsername: row.referrerUsername,
          referrerCode: row.referrerCode,
          referralCount: Number(row.referralCount ?? 0),
        })),
        recentReferrals: recent.map((row) => ({
          userId: row.userId,
          username: row.username,
          referredAt: row.referredAt,
          referrerUserId: row.referrerUserId,
          referrerUsername: row.referrerUsername,
          referrerCode: row.referrerCode,
        })),
      },
    });
  } catch (err) {
    logger.error({ err }, "admin referrals overview error");
    res.status(500).json({ success: false, error: "Failed to load referrals overview" });
  }
}
