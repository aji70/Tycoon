import db from "../config/database.js";
import logger from "../config/logger.js";

function parseDateStart(s) {
  if (s == null || String(s).trim() === "") return null;
  const d = new Date(String(s));
  return Number.isNaN(d.getTime()) ? null : d;
}

function escapeLike(s) {
  return String(s).replace(/[%_\\]/g, "\\$&");
}

/**
 * GET /api/admin/audit-log
 * Query: page, pageSize, action, targetType, q (search action or target_id), startDate, endDate
 */
export async function listAuditLog(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 40));
    const actionFilter = req.query.action != null ? String(req.query.action).trim() : "";
    const targetTypeFilter = req.query.targetType != null ? String(req.query.targetType).trim() : "";
    const q = req.query.q != null ? String(req.query.q).trim() : "";
    const start = parseDateStart(req.query.startDate ?? req.query.start);
    const end = parseDateStart(req.query.endDate ?? req.query.end);

    const base = db("admin_audit_log");
    if (actionFilter) {
      base.where("action", "like", `%${escapeLike(actionFilter)}%`);
    }
    if (targetTypeFilter) {
      base.where("target_type", targetTypeFilter);
    }
    if (start) {
      base.where("created_at", ">=", start);
    }
    if (end) {
      base.where("created_at", "<=", end);
    }
    if (q) {
      const pat = `%${escapeLike(q)}%`;
      base.where(function () {
        this.where("action", "like", pat).orWhere("target_id", "like", pat);
      });
    }

    const countRow = await base.clone().count("* as c").first();
    const total = Number(countRow?.c ?? 0);

    const rows = await base
      .clone()
      .select("id", "action", "target_type", "target_id", "payload_json", "ip", "user_agent", "created_at")
      .orderBy("id", "desc")
      .offset((page - 1) * pageSize)
      .limit(pageSize);

    res.json({
      success: true,
      data: {
        entries: rows.map((r) => ({
          id: r.id,
          action: r.action,
          targetType: r.target_type,
          targetId: r.target_id,
          payload: r.payload_json,
          ip: r.ip,
          userAgent: r.user_agent,
          createdAt: r.created_at,
        })),
        total,
        page,
        pageSize,
      },
    });
  } catch (err) {
    logger.error({ err }, "admin listAuditLog error");
    res.status(500).json({ success: false, error: "Failed to list audit log" });
  }
}
