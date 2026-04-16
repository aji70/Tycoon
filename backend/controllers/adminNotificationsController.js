import db from "../config/database.js";
import logger from "../config/logger.js";
import { isMaintenanceModeEnabled } from "../services/platformSettings.js";

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
 * GET /api/admin/notifications
 * Lightweight digest for the admin header (no persistent read-state yet).
 */
export async function listNotifications(req, res) {
  const generatedAt = new Date().toISOString();
  const items = [];
  let openReports = 0;
  let attachFailures = 0;
  let errorEvents = 0;
  let maintenanceOn = false;

  try {
    maintenanceOn = await isMaintenanceModeEnabled();
    if (maintenanceOn) {
      items.push({
        id: "maintenance",
        kind: "maintenance",
        title: "Maintenance mode is ON",
        href: "/admin/settings",
        createdAt: generatedAt,
      });
    }
  } catch (err) {
    logger.warn({ err }, "admin notifications maintenance read failed");
  }

  try {
    const row = await db("moderation_reports").where("status", "open").count("* as c").first();
    openReports = Number(row?.c ?? 0);
    const reports = await db("moderation_reports as mr")
      .leftJoin("users as target", "mr.target_user_id", "target.id")
      .where("mr.status", "open")
      .select("mr.id", "mr.category", "mr.created_at as createdAt", db.raw("target.username as targetUsername"))
      .orderBy("mr.created_at", "desc")
      .limit(5);

    for (const r of reports) {
      items.push({
        id: `report-${r.id}`,
        kind: "moderation",
        title: `Open report #${r.id} · ${r.category}`,
        subtitle: r.targetUsername ? `Target: ${r.targetUsername}` : null,
        href: "/admin/moderation",
        createdAt: r.createdAt,
      });
    }
  } catch (err) {
    if (!isMissingTable(err)) logger.warn({ err }, "admin notifications reports skipped");
  }

  try {
    const has = await db.schema.hasTable("referral_events");
    if (has) {
      const c = await db("referral_events").where("event_type", "attach_failed").count("* as c").first();
      attachFailures = Number(c?.c ?? 0);
      const rows = await db("referral_events")
        .where("event_type", "attach_failed")
        .select("id", "failure_reason", "created_at as createdAt")
        .orderBy("created_at", "desc")
        .limit(3);
      for (const r of rows) {
        items.push({
          id: `ref-fail-${r.id}`,
          kind: "referral",
          title: `Referral attach failed (#${r.id})`,
          subtitle: r.failure_reason || null,
          href: "/admin/referrals",
          createdAt: r.createdAt,
        });
      }
    }
  } catch (err) {
    logger.warn({ err }, "admin notifications referral_events skipped");
  }

  try {
    const has = await db.schema.hasTable("analytics_events");
    if (has) {
      const c = await db("analytics_events").where("event_type", "error").count("* as c").first();
      errorEvents = Number(c?.c ?? 0);
      const rows = await db("analytics_events")
        .where("event_type", "error")
        .select("id", "created_at as createdAt")
        .orderBy("created_at", "desc")
        .limit(3);
      for (const r of rows) {
        items.push({
          id: `err-${r.id}`,
          kind: "error",
          title: `Analytics error #${r.id}`,
          href: "/admin/analytics",
          createdAt: r.createdAt,
        });
      }
    }
  } catch (err) {
    logger.warn({ err }, "admin notifications analytics_events skipped");
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const badgeCount = Math.min(99, openReports + attachFailures + errorEvents + (maintenanceOn ? 1 : 0));

  res.json({
    success: true,
    data: {
      generatedAt,
      summary: { openReports, attachFailures, errorEvents, maintenanceOn },
      badgeCount,
      items: items.slice(0, 20),
    },
  });
}
