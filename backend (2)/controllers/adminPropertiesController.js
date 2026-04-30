import db from "../config/database.js";
import logger from "../config/logger.js";
import Property from "../models/Property.js";
import redis from "../config/redis.js";
import { recordEvent } from "../services/analytics.js";
import { appendAdminAuditLog } from "../services/adminAuditLog.js";

const PATCHABLE = new Set([
  "name",
  "type",
  "group_id",
  "position",
  "grid_row",
  "grid_col",
  "price",
  "rent_site_only",
  "rent_one_house",
  "rent_two_houses",
  "rent_three_houses",
  "rent_four_houses",
  "rent_hotel",
  "cost_of_house",
  "is_mortgaged",
  "color",
  "icon",
]);

async function invalidatePropertyCache(propertyId) {
  try {
    await redis.del(`property:${propertyId}`);
    await redis.del("properties");
  } catch (_) {}
}

async function ownershipCountsForIds(ids) {
  if (!ids.length) return {};
  const rows = await db("game_properties")
    .select("property_id")
    .count("* as c")
    .whereIn("property_id", ids)
    .groupBy("property_id");
  return Object.fromEntries(rows.map((r) => [Number(r.property_id), Number(r.c)]));
}

/**
 * GET /api/admin/properties
 */
export async function listProperties(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
    const q = req.query.q != null ? String(req.query.q).trim() : "";

    const base = db("properties");
    if (q) {
      if (/^\d+$/.test(q)) {
        base.where(function () {
          this.where("id", Number(q)).orWhereRaw("LOWER(name) LIKE ?", [`%${q.toLowerCase()}%`]);
        });
      } else {
        base.whereRaw("LOWER(name) LIKE ?", [`%${q.toLowerCase()}%`]);
      }
    }

    const countRow = await base.clone().count("* as c").first();
    const total = Number(countRow?.c ?? 0);

    const rows = await base
      .clone()
      .select("*")
      .orderBy("id", "asc")
      .offset((page - 1) * pageSize)
      .limit(pageSize);

    const counts = await ownershipCountsForIds(rows.map((r) => r.id));
    const properties = rows.map((p) => ({
      ...p,
      ownershipRows: counts[Number(p.id)] ?? 0,
    }));

    res.json({
      success: true,
      data: { properties, total, page, pageSize },
    });
  } catch (err) {
    logger.error({ err }, "admin listProperties error");
    res.status(500).json({ success: false, error: "Failed to list properties" });
  }
}

/**
 * GET /api/admin/properties/:id
 */
export async function getProperty(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid property id" });
    }

    const row = await Property.findById(id);
    if (!row) {
      return res.status(404).json({ success: false, error: "Property not found" });
    }

    const countRow = await db("game_properties").where({ property_id: id }).count("* as c").first();
    const ownershipRows = Number(countRow?.c ?? 0);

    res.json({
      success: true,
      data: { property: row, ownershipRows },
    });
  } catch (err) {
    logger.error({ err }, "admin getProperty error");
    res.status(500).json({ success: false, error: "Failed to load property" });
  }
}

function coercePatchValue(key, val) {
  if (val === null || val === undefined) return undefined;
  if (key === "is_mortgaged") {
    if (typeof val === "boolean") return val;
    if (val === "true" || val === "1" || val === 1) return true;
    if (val === "false" || val === "0" || val === 0) return false;
    return undefined;
  }
  if (
    [
      "group_id",
      "grid_row",
      "grid_col",
      "price",
      "rent_site_only",
      "rent_one_house",
      "rent_two_houses",
      "rent_three_houses",
      "rent_four_houses",
      "rent_hotel",
      "cost_of_house",
    ].includes(key)
  ) {
    const n = Number(val);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return undefined;
    return n;
  }
  if (key === "icon") {
    const s = String(val).trim();
    return s === "" ? null : s;
  }
  if (["name", "type", "position", "color"].includes(key)) {
    return String(val).trim();
  }
  return undefined;
}

/**
 * PATCH /api/admin/properties/:id
 */
export async function patchProperty(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid property id" });
    }

    const existing = await Property.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Property not found" });
    }

    const body = req.body || {};
    const payload = {};
    for (const key of Object.keys(body)) {
      if (!PATCHABLE.has(key)) continue;
      const v = coercePatchValue(key, body[key]);
      if (v !== undefined) payload[key] = v;
    }

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid patchable fields supplied",
      });
    }

    await Property.update(id, payload);
    await invalidatePropertyCache(id);
    await recordEvent("admin_property_patched", {
      entityType: "property",
      entityId: id,
      payload: { keys: Object.keys(payload) },
    });

    await appendAdminAuditLog({
      action: "properties.patch",
      targetType: "property",
      targetId: String(id),
      payload: { keys: Object.keys(payload), patch: payload },
      req,
    });

    const property = await Property.findById(id);
    const countRow = await db("game_properties").where({ property_id: id }).count("* as c").first();
    const ownershipRows = Number(countRow?.c ?? 0);

    res.json({
      success: true,
      data: { property, ownershipRows },
    });
  } catch (err) {
    logger.error({ err }, "admin patchProperty error");
    res.status(500).json({ success: false, error: "Failed to update property" });
  }
}
