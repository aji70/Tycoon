import db from "../config/database.js";
import logger from "../config/logger.js";
import { appendAdminAuditLog } from "../services/adminAuditLog.js";

function normalizeSlug(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function isValidSlug(slug) {
  if (!slug || slug.length > 64) return false;
  return /^(?:[a-z0-9]|[a-z0-9][a-z0-9-]*[a-z0-9])$/.test(slug);
}

/**
 * GET /api/admin/quests
 * Query: page, pageSize, q, active (true|false|empty=all)
 */
export async function listQuests(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const q = req.query.q != null ? String(req.query.q).trim() : "";
    const activeRaw = req.query.active;

    const base = db("quest_definitions");
    if (activeRaw === "true") base.where("active", true);
    else if (activeRaw === "false") base.where("active", false);

    if (q) {
      const pat = `%${q.toLowerCase()}%`;
      base.where(function () {
        this.whereRaw("LOWER(title) LIKE ?", [pat]).orWhereRaw("LOWER(slug) LIKE ?", [pat]);
        if (/^\d+$/.test(q)) this.orWhere("id", Number(q));
      });
    }

    const countRow = await base.clone().count("* as c").first();
    const total = Number(countRow?.c ?? 0);

    const rows = await base
      .clone()
      .select("id", "slug", "title", "description", "active", "sort_order", "rules_json", "reward_hint", "created_at", "updated_at")
      .orderBy("sort_order", "asc")
      .orderBy("id", "asc")
      .offset((page - 1) * pageSize)
      .limit(pageSize);

    res.json({
      success: true,
      data: {
        quests: rows.map((r) => ({
          id: r.id,
          slug: r.slug,
          title: r.title,
          description: r.description,
          active: !!r.active,
          sortOrder: r.sort_order,
          rulesJson: r.rules_json,
          rewardHint: r.reward_hint,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
        total,
        page,
        pageSize,
      },
    });
  } catch (err) {
    logger.error({ err }, "admin listQuests error");
    res.status(500).json({ success: false, error: "Failed to list quests" });
  }
}

/**
 * GET /api/admin/quests/:id
 */
export async function getQuestById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid quest id" });
    }
    const row = await db("quest_definitions").where({ id }).first();
    if (!row) {
      return res.status(404).json({ success: false, error: "Quest not found" });
    }
    res.json({
      success: true,
      data: {
        quest: {
          id: row.id,
          slug: row.slug,
          title: row.title,
          description: row.description,
          active: !!row.active,
          sortOrder: row.sort_order,
          rulesJson: row.rules_json,
          rewardHint: row.reward_hint,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      },
    });
  } catch (err) {
    logger.error({ err }, "admin getQuestById error");
    res.status(500).json({ success: false, error: "Failed to load quest" });
  }
}

/**
 * POST /api/admin/quests
 * Body: { slug, title, description?, active?, sortOrder?, rulesJson?, rewardHint? }
 */
export async function createQuest(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const slug = normalizeSlug(body.slug);
    const title = body.title != null ? String(body.title).trim().slice(0, 200) : "";

    if (!title) return res.status(400).json({ success: false, error: "title is required" });
    if (!isValidSlug(slug)) {
      return res.status(400).json({ success: false, error: "slug must be 1–64 chars: lowercase letters, digits, hyphens (no leading/trailing hyphen)" });
    }

    const active = body.active === false ? false : true;
    const sortOrder = Number(body.sortOrder ?? body.sort_order);
    const sort_order = Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0;
    const description = body.description != null ? String(body.description).slice(0, 16000) : null;
    const reward_hint = body.rewardHint != null || body.reward_hint != null
      ? String(body.rewardHint ?? body.reward_hint).slice(0, 200) : null;

    let rules_json = null;
    if (body.rulesJson != null || body.rules_json != null) {
      const raw = body.rulesJson ?? body.rules_json;
      if (raw !== null && typeof raw === "object") {
        rules_json = raw;
      } else if (typeof raw === "string" && raw.trim()) {
        try { rules_json = JSON.parse(raw); }
        catch { return res.status(400).json({ success: false, error: "rulesJson must be valid JSON object" }); }
      }
    }

    const row = await db.transaction(async (trx) => {
      const [insertId] = await trx("quest_definitions").insert({
        slug, title, description: description || null, active, sort_order, rules_json, reward_hint: reward_hint || null,
      });
      await appendAdminAuditLog({ action: "quests.create", targetType: "quest_definition", targetId: String(insertId), payload: { slug, title, active }, req });
      return trx("quest_definitions").where({ id: insertId }).first();
    });

    res.status(201).json({ success: true, data: { quest: { id: row.id, slug: row.slug, title: row.title, description: row.description, active: !!row.active, sortOrder: row.sort_order, rulesJson: row.rules_json, rewardHint: row.reward_hint, createdAt: row.created_at, updatedAt: row.updated_at } } });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ success: false, error: "Slug already exists" });
    logger.error({ err }, "admin createQuest error");
    res.status(500).json({ success: false, error: "Failed to create quest" });
  }
}

/**
 * PATCH /api/admin/quests/:id
 */
export async function patchQuest(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid quest id" });
    }

    const existing = await db("quest_definitions").where({ id }).first();
    if (!existing) {
      return res.status(404).json({ success: false, error: "Quest not found" });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const patch = {};

    if (body.slug !== undefined) {
      const slug = normalizeSlug(body.slug);
      if (!isValidSlug(slug)) {
        return res.status(400).json({ success: false, error: "Invalid slug" });
      }
      patch.slug = slug;
    }
    if (body.title !== undefined) {
      const t = String(body.title).trim().slice(0, 200);
      if (!t) return res.status(400).json({ success: false, error: "title cannot be empty" });
      patch.title = t;
    }
    if (body.description !== undefined) {
      patch.description = body.description === null ? null : String(body.description).slice(0, 16000);
    }
    if (body.active !== undefined) {
      patch.active = Boolean(body.active);
    }
    if (body.sortOrder !== undefined || body.sort_order !== undefined) {
      const n = Number(body.sortOrder ?? body.sort_order);
      patch.sort_order = Number.isFinite(n) ? Math.trunc(n) : 0;
    }
    if (body.rewardHint !== undefined || body.reward_hint !== undefined) {
      const v = body.rewardHint ?? body.reward_hint;
      patch.reward_hint = v === null || v === "" ? null : String(v).slice(0, 200);
    }
    if (body.rulesJson !== undefined || body.rules_json !== undefined) {
      const raw = body.rulesJson ?? body.rules_json;
      if (raw === null) {
        patch.rules_json = null;
      } else if (typeof raw === "object") {
        patch.rules_json = raw;
      } else if (typeof raw === "string" && raw.trim()) {
        try {
          patch.rules_json = JSON.parse(raw);
        } catch {
          return res.status(400).json({ success: false, error: "rulesJson must be valid JSON" });
        }
      }
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ success: false, error: "No valid fields to update" });
    }

    patch.updated_at = db.fn.now();

    const row = await db.transaction(async (trx) => {
      await trx("quest_definitions").where({ id }).update(patch);
      await appendAdminAuditLog({ action: "quests.patch", targetType: "quest_definition", targetId: String(id), payload: { keys: Object.keys(patch).filter((k) => k !== "updated_at") }, req });
      return trx("quest_definitions").where({ id }).first();
    });

    res.json({ success: true, data: { quest: { id: row.id, slug: row.slug, title: row.title, description: row.description, active: !!row.active, sortOrder: row.sort_order, rulesJson: row.rules_json, rewardHint: row.reward_hint, createdAt: row.created_at, updatedAt: row.updated_at } } });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, error: "Slug already exists" });
    }
    logger.error({ err }, "admin patchQuest error");
    res.status(500).json({ success: false, error: "Failed to update quest" });
  }
}

/**
 * DELETE /api/admin/quests/:id
 */
export async function deleteQuest(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid quest id" });
    }

    const existing = await db("quest_definitions").where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, error: "Quest not found" });

    await db.transaction(async (trx) => {
      await trx("quest_definitions").where({ id }).delete();
      await appendAdminAuditLog({ action: "quests.delete", targetType: "quest_definition", targetId: String(id), payload: { slug: existing.slug, title: existing.title }, req });
    });

    res.json({ success: true, data: { deletedId: id } });
  } catch (err) {
    logger.error({ err }, "admin deleteQuest error");
    res.status(500).json({ success: false, error: "Failed to delete quest" });
  }
}
