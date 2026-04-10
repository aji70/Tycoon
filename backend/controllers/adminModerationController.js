import db from "../config/database.js";
import logger from "../config/logger.js";
import { appendAdminAuditLog } from "../services/adminAuditLog.js";

const STATUS = new Set(["open", "reviewing", "resolved", "dismissed"]);
const SORT_WHITELIST = {
  created_at_desc: [{ column: "moderation_reports.created_at", direction: "desc" }],
  created_at_asc: [{ column: "moderation_reports.created_at", direction: "asc" }],
  id_desc: [{ column: "moderation_reports.id", direction: "desc" }],
};

function applyListFilters(qb, { status, category, q }) {
  if (status && STATUS.has(String(status))) {
    qb.where("moderation_reports.status", String(status));
  }
  if (category != null && String(category).trim() !== "") {
    qb.where("moderation_reports.category", String(category).trim());
  }
  const search = q != null ? String(q).trim() : "";
  if (search) {
    const pat = `%${search.toLowerCase()}%`;
    qb.where(function () {
      this.whereRaw("LOWER(COALESCE(moderation_reports.details, '')) LIKE ?", [pat]).orWhereRaw(
        "LOWER(COALESCE(moderation_reports.admin_note, '')) LIKE ?",
        [pat]
      );
      if (/^\d+$/.test(search)) {
        this.orWhere("moderation_reports.id", Number(search));
      }
    });
  }
}

function baseSelect() {
  return db("moderation_reports")
    .leftJoin("users as reporter", "moderation_reports.reporter_user_id", "reporter.id")
    .leftJoin("users as target", "moderation_reports.target_user_id", "target.id")
    .select(
      "moderation_reports.id",
      "moderation_reports.reporter_user_id",
      "moderation_reports.target_user_id",
      "moderation_reports.target_type",
      "moderation_reports.target_ref",
      "moderation_reports.category",
      "moderation_reports.details",
      "moderation_reports.status",
      "moderation_reports.admin_note",
      "moderation_reports.resolved_at",
      "moderation_reports.created_at",
      "moderation_reports.updated_at",
      db.raw("reporter.username as reporter_username"),
      db.raw("target.username as target_username")
    );
}

/**
 * GET /api/admin/moderation/reports
 */
export async function listReports(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const sortKey = SORT_WHITELIST[req.query.sort] ? req.query.sort : "created_at_desc";
    const orderSpecs = SORT_WHITELIST[sortKey];
    const filters = { status: req.query.status, category: req.query.category, q: req.query.q };

    const countQb = db("moderation_reports");
    applyListFilters(countQb, filters);
    const countRow = await countQb.count("* as c").first();
    const total = Number(countRow?.c ?? 0);

    let listQb = baseSelect();
    applyListFilters(listQb, filters);
    for (const { column, direction } of orderSpecs) {
      listQb = listQb.orderBy(column, direction);
    }
    listQb = listQb.orderBy("moderation_reports.id", "desc").offset((page - 1) * pageSize).limit(pageSize);

    const rows = await listQb;

    res.json({
      success: true,
      data: {
        reports: rows.map((r) => ({
          id: r.id,
          reporterUserId: r.reporter_user_id,
          reporterUsername: r.reporter_username ?? null,
          targetUserId: r.target_user_id,
          targetUsername: r.target_username ?? null,
          targetType: r.target_type,
          targetRef: r.target_ref,
          category: r.category,
          details: r.details,
          status: r.status,
          adminNote: r.admin_note,
          resolvedAt: r.resolved_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
        total,
        page,
        pageSize,
        sort: sortKey,
      },
    });
  } catch (err) {
    logger.error({ err }, "admin listReports error");
    res.status(500).json({ success: false, error: "Failed to list reports" });
  }
}

/**
 * GET /api/admin/moderation/reports/:id
 */
export async function getReportById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid report id" });
    }
    const row = await baseSelect().where("moderation_reports.id", id).first();
    if (!row) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }
    res.json({
      success: true,
      data: {
        report: {
          id: row.id,
          reporterUserId: row.reporter_user_id,
          reporterUsername: row.reporter_username ?? null,
          targetUserId: row.target_user_id,
          targetUsername: row.target_username ?? null,
          targetType: row.target_type,
          targetRef: row.target_ref,
          category: row.category,
          details: row.details,
          status: row.status,
          adminNote: row.admin_note,
          resolvedAt: row.resolved_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      },
    });
  } catch (err) {
    logger.error({ err }, "admin getReportById error");
    res.status(500).json({ success: false, error: "Failed to load report" });
  }
}

/**
 * PATCH /api/admin/moderation/reports/:id
 * Body: { status?, adminNote? }
 */
export async function patchReport(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid report id" });
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const patch = {};

    if (body.status != null) {
      const s = String(body.status).trim();
      if (!STATUS.has(s)) {
        return res.status(400).json({ success: false, error: "Invalid status" });
      }
      patch.status = s;
      if (s === "resolved" || s === "dismissed") {
        patch.resolved_at = db.fn.now();
      } else {
        patch.resolved_at = null;
      }
    }
    if (body.adminNote !== undefined) {
      patch.admin_note =
        body.adminNote === null || body.adminNote === ""
          ? null
          : String(body.adminNote).slice(0, 8000);
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ success: false, error: "No valid fields to update" });
    }

    const updated = await db("moderation_reports").where("id", id).update(patch);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }

    await appendAdminAuditLog({
      action: "moderation.report_patch",
      targetType: "moderation_report",
      targetId: String(id),
      payload: { updatedFields: Object.keys(patch) },
      req,
    });

    const row = await baseSelect().where("moderation_reports.id", id).first();
    res.json({
      success: true,
      data: {
        report: {
          id: row.id,
          reporterUserId: row.reporter_user_id,
          reporterUsername: row.reporter_username ?? null,
          targetUserId: row.target_user_id,
          targetUsername: row.target_username ?? null,
          targetType: row.target_type,
          targetRef: row.target_ref,
          category: row.category,
          details: row.details,
          status: row.status,
          adminNote: row.admin_note,
          resolvedAt: row.resolved_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      },
    });
  } catch (err) {
    logger.error({ err }, "admin patchReport error");
    res.status(500).json({ success: false, error: "Failed to update report" });
  }
}

/**
 * POST /api/admin/moderation/reports
 * Manual intake (admin or future in-game reporter with user id).
 * Body: { category, details?, targetUserId?, reporterUserId?, targetType?, targetRef? }
 */
export async function createReport(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const category = body.category != null ? String(body.category).trim() : "";
    if (!category || category.length > 64) {
      return res.status(400).json({ success: false, error: "category is required (max 64 chars)" });
    }
    const details =
      body.details == null || body.details === "" ? null : String(body.details).slice(0, 32000);
    const targetType =
      body.targetType != null && String(body.targetType).trim() !== ""
        ? String(body.targetType).trim().slice(0, 32)
        : "user";
    const targetRef =
      body.targetRef != null && String(body.targetRef).trim() !== ""
        ? String(body.targetRef).trim().slice(0, 128)
        : null;

    let reporterUserId = null;
    if (body.reporterUserId != null && body.reporterUserId !== "") {
      const rid = Number(body.reporterUserId);
      if (!Number.isFinite(rid) || rid < 1) {
        return res.status(400).json({ success: false, error: "Invalid reporterUserId" });
      }
      const u = await db("users").where("id", rid).first("id");
      if (!u) return res.status(400).json({ success: false, error: "reporterUserId not found" });
      reporterUserId = rid;
    }

    let targetUserId = null;
    if (body.targetUserId != null && body.targetUserId !== "") {
      const tid = Number(body.targetUserId);
      if (!Number.isFinite(tid) || tid < 1) {
        return res.status(400).json({ success: false, error: "Invalid targetUserId" });
      }
      const u = await db("users").where("id", tid).first("id");
      if (!u) return res.status(400).json({ success: false, error: "targetUserId not found" });
      targetUserId = tid;
    }

    const [insertId] = await db("moderation_reports").insert({
      reporter_user_id: reporterUserId,
      target_user_id: targetUserId,
      target_type: targetType,
      target_ref: targetRef,
      category,
      details,
      status: "open",
    });

    await appendAdminAuditLog({
      action: "moderation.report_create",
      targetType: "moderation_report",
      targetId: String(insertId),
      payload: {
        category,
        reporterUserId,
        targetUserId,
        targetType,
        targetRef,
      },
      req,
    });

    const row = await baseSelect().where("moderation_reports.id", insertId).first();
    res.status(201).json({
      success: true,
      data: {
        report: {
          id: row.id,
          reporterUserId: row.reporter_user_id,
          reporterUsername: row.reporter_username ?? null,
          targetUserId: row.target_user_id,
          targetUsername: row.target_username ?? null,
          targetType: row.target_type,
          targetRef: row.target_ref,
          category: row.category,
          details: row.details,
          status: row.status,
          adminNote: row.admin_note,
          resolvedAt: row.resolved_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      },
    });
  } catch (err) {
    logger.error({ err }, "admin createReport error");
    res.status(500).json({ success: false, error: "Failed to create report" });
  }
}
