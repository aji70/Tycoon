import db from "../config/database.js";
import logger from "../config/logger.js";

function isMissingTable(err) {
  return (
    err?.errno === 1146 ||
    err?.code === "ER_NO_SUCH_TABLE" ||
    err?.code === "42P01" ||
    (typeof err?.message === "string" &&
      (err.message.includes("does not exist") || err.message.includes("doesn't exist")))
  );
}

/**
 * GET /api/admin/alerts
 * Lightweight slices for the admin shell: open moderation queue, failed referral attaches, recent analytics errors.
 */
export async function getAlerts(req, res) {
  const generatedAt = new Date().toISOString();

  const flaggedPlayers = { openCount: 0, items: [] };
  const suspiciousWallets = { attachFailedTotal: 0, items: [] };
  const gameErrors = { errorEventTotal: 0, items: [] };

  try {
    const openRow = await db("moderation_reports").where("status", "open").count("* as c").first();
    flaggedPlayers.openCount = Number(openRow?.c ?? 0);

    const openReports = await db("moderation_reports as mr")
      .leftJoin("users as target", "mr.target_user_id", "target.id")
      .where("mr.status", "open")
      .select(
        "mr.id",
        "mr.target_user_id as targetUserId",
        "mr.category",
        "mr.details",
        "mr.created_at as createdAt",
        db.raw("target.username as targetUsername")
      )
      .orderBy("mr.created_at", "desc")
      .limit(6);

    flaggedPlayers.items = openReports.map((r) => ({
      id: r.id,
      targetUserId: r.targetUserId,
      targetUsername: r.targetUsername ?? null,
      category: r.category,
      detailsPreview:
        r.details && String(r.details).length > 120 ? `${String(r.details).slice(0, 117)}…` : r.details ?? null,
      createdAt: r.createdAt,
    }));
  } catch (err) {
    if (!isMissingTable(err)) {
      logger.warn({ err }, "admin alerts: moderation_reports skipped");
    }
  }

  try {
    const hasRef = await db.schema.hasTable("referral_events");
    if (hasRef) {
      const failRow = await db("referral_events").where("event_type", "attach_failed").count("* as c").first();
      suspiciousWallets.attachFailedTotal = Number(failRow?.c ?? 0);

      const fails = await db("referral_events as e")
        .leftJoin("users as referee", "e.referee_user_id", "referee.id")
        .where("e.event_type", "attach_failed")
        .select(
          "e.id",
          "e.referee_user_id as refereeUserId",
          "e.failure_reason as failureReason",
          "e.code_normalized as codeNormalized",
          "e.created_at as createdAt",
          db.raw("referee.username as refereeUsername"),
          "referee.address as refereeAddress"
        )
        .orderBy("e.created_at", "desc")
        .limit(6);

      suspiciousWallets.items = fails.map((r) => ({
        id: r.id,
        refereeUserId: r.refereeUserId,
        refereeUsername: r.refereeUsername ?? null,
        refereeAddress: r.refereeAddress ?? null,
        failureReason: r.failureReason ?? null,
        codeNormalized: r.codeNormalized ?? null,
        createdAt: r.createdAt,
      }));
    }
  } catch (err) {
    logger.warn({ err }, "admin alerts: referral_events skipped");
  }

  try {
    const hasAe = await db.schema.hasTable("analytics_events");
    if (hasAe) {
      const errRow = await db("analytics_events").where("event_type", "error").count("* as c").first();
      gameErrors.errorEventTotal = Number(errRow?.c ?? 0);

      const errs = await db("analytics_events")
        .select("id", "entity_type as entityType", "entity_id as entityId", "payload", "created_at as createdAt")
        .where("event_type", "error")
        .orderBy("created_at", "desc")
        .limit(6);

      gameErrors.items = errs.map((r) => {
        let payloadPreview = null;
        if (r.payload != null) {
          const s = typeof r.payload === "string" ? r.payload : JSON.stringify(r.payload);
          payloadPreview = s.length > 140 ? `${s.slice(0, 137)}…` : s;
        }
        return {
          id: r.id,
          entityType: r.entityType,
          entityId: r.entityId,
          payloadPreview,
          createdAt: r.createdAt,
        };
      });
    }
  } catch (err) {
    logger.warn({ err }, "admin alerts: analytics_events skipped");
  }

  res.json({
    success: true,
    data: {
      generatedAt,
      flaggedPlayers,
      suspiciousWallets,
      gameErrors,
    },
  });
}
