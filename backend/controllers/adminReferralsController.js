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

/**
 * GET /api/admin/referrals/events
 * Query: page, pageSize, refereeUserId, referrerUserId, eventType, source
 */
export async function listReferralEvents(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 40));
    const refereeUserId = req.query.refereeUserId != null && req.query.refereeUserId !== "" ? Number(req.query.refereeUserId) : null;
    const referrerUserId = req.query.referrerUserId != null && req.query.referrerUserId !== "" ? Number(req.query.referrerUserId) : null;
    const eventType = req.query.eventType != null ? String(req.query.eventType).trim() : "";
    const source = req.query.source != null ? String(req.query.source).trim() : "";

    const base = db("referral_events as e")
      .leftJoin("users as referee", "e.referee_user_id", "referee.id")
      .leftJoin("users as referrer", "e.referrer_user_id", "referrer.id");

    if (refereeUserId != null && Number.isFinite(refereeUserId) && refereeUserId > 0) {
      base.where("e.referee_user_id", refereeUserId);
    }
    if (referrerUserId != null && Number.isFinite(referrerUserId) && referrerUserId > 0) {
      base.where("e.referrer_user_id", referrerUserId);
    }
    if (eventType === "attach_success" || eventType === "attach_failed") {
      base.where("e.event_type", eventType);
    }
    if (source === "api" || source === "privy_signin" || source === "unknown") {
      base.where("e.source", source);
    }

    const countRow = await base.clone().count("* as c").first();
    const total = Number(countRow?.c ?? 0);

    const rows = await base
      .clone()
      .select(
        "e.id",
        "e.referee_user_id",
        "e.event_type",
        "e.referrer_user_id",
        "e.code_normalized",
        "e.failure_reason",
        "e.source",
        "e.metadata",
        "e.created_at",
        "referee.username as refereeUsername",
        "referrer.username as referrerUsername"
      )
      .orderBy("e.created_at", "desc")
      .offset((page - 1) * pageSize)
      .limit(pageSize);

    res.json({
      success: true,
      data: {
        events: rows.map((r) => ({
          id: r.id,
          refereeUserId: r.referee_user_id,
          refereeUsername: r.refereeUsername ?? null,
          eventType: r.event_type,
          referrerUserId: r.referrer_user_id,
          referrerUsername: r.referrerUsername ?? null,
          codeNormalized: r.code_normalized,
          failureReason: r.failure_reason,
          source: r.source,
          metadata: r.metadata,
          createdAt: r.created_at,
        })),
        total,
        page,
        pageSize,
      },
    });
  } catch (err) {
    const missing =
      err.errno === 1146 ||
      err.code === "ER_NO_SUCH_TABLE" ||
      (typeof err.message === "string" && err.message.includes("doesn't exist"));
    if (missing) {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 40));
      return res.json({
        success: true,
        data: {
          events: [],
          total: 0,
          page,
          pageSize,
          tableMissing: true,
        },
      });
    }
    logger.error({ err }, "admin listReferralEvents error");
    res.status(500).json({ success: false, error: "Failed to load referral events" });
  }
}
