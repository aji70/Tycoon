import db from "../config/database.js";
import redis from "../config/redis.js";
import logger from "../config/logger.js";
import { invalidatePropertyListCaches } from "../utils/boardVariant.js";
import { appendAdminAuditLog } from "../services/adminAuditLog.js";

/**
 * GET /api/admin/board-variants
 */
export async function listBoardVariants(req, res) {
  try {
    const variants = await db("board_variants").select("*").orderBy("name", "asc");
    res.json({ success: true, data: { variants } });
  } catch (err) {
    logger.error({ err }, "admin listBoardVariants error");
    res.status(500).json({ success: false, error: "Failed to list board variants" });
  }
}

/**
 * GET /api/admin/board-variants/:id/squares
 * Canonical catalog + effective display name per square (override or catalog).
 */
export async function getBoardVariantSquares(req, res) {
  try {
    const variantId = String(req.params.id || "").trim();
    if (!variantId) {
      return res.status(400).json({ success: false, error: "Missing variant id" });
    }

    const variant = await db("board_variants").where({ id: variantId }).first();
    if (!variant) {
      return res.status(404).json({ success: false, error: "Board variant not found" });
    }

    const canonical = await db("properties").whereNull("board_id").orderBy("id", "asc");
    const overrides = await db("board_variant_square_names").where({ board_variant_id: variantId });
    const overMap = Object.fromEntries(overrides.map((o) => [Number(o.property_id), String(o.display_name)]));

    const squares = canonical.map((p) => {
      const pid = Number(p.id);
      const override = overMap[pid];
      const catalogName = String(p.name ?? "");
      const effective = override !== undefined && override !== "" ? override : catalogName;
      return {
        property_id: pid,
        type: p.type,
        group_id: p.group_id,
        catalog_name: catalogName,
        display_name: effective,
        uses_override: Boolean(override !== undefined && override !== ""),
      };
    });

    res.json({
      success: true,
      data: { variant, squares },
    });
  } catch (err) {
    logger.error({ err }, "admin getBoardVariantSquares error");
    res.status(500).json({ success: false, error: "Failed to load squares" });
  }
}

function sanitizeSquarePayload(body) {
  const squares = body?.squares;
  if (!Array.isArray(squares)) return null;
  const out = [];
  for (const s of squares) {
    const pid = Number(s.property_id ?? s.propertyId);
    if (!Number.isInteger(pid) || pid < 0 || pid > 39) continue;
    const display_name =
      s.display_name != null ? String(s.display_name).trim() : String(s.displayName ?? "").trim();
    out.push({ property_id: pid, display_name });
  }
  return out;
}

/**
 * PUT /api/admin/board-variants/:id/squares
 * Body: { squares: [{ property_id, display_name }] }
 * Empty display_name removes override (falls back to catalog name for games).
 */
export async function putBoardVariantSquares(req, res) {
  try {
    const variantId = String(req.params.id || "").trim();
    if (!variantId) {
      return res.status(400).json({ success: false, error: "Missing variant id" });
    }

    if (variantId === "default") {
      return res.status(400).json({
        success: false,
        error:
          'Cannot edit theme overrides for variant "default". Edit canonical rows under Admin → Properties instead.',
      });
    }

    const variant = await db("board_variants").where({ id: variantId }).first();
    if (!variant) {
      return res.status(404).json({ success: false, error: "Board variant not found" });
    }

    const parsed = sanitizeSquarePayload(req.body || {});
    if (!parsed) {
      return res.status(400).json({ success: false, error: "Body must include squares: [{ property_id, display_name }]" });
    }

    const canonical = await db("properties").whereNull("board_id").select("id", "name");
    const catalogMap = Object.fromEntries(canonical.map((p) => [Number(p.id), String(p.name ?? "")]));

    const inserts = parsed.filter((x) => {
      const cat = catalogMap[x.property_id];
      return x.display_name !== "" && x.display_name !== cat;
    });

    await db.transaction(async (trx) => {
      await trx("board_variant_square_names").where({ board_variant_id: variantId }).del();
      if (inserts.length) {
        await trx.batchInsert(
          "board_variant_square_names",
          inserts.map((x) => ({
            board_variant_id: variantId,
            property_id: x.property_id,
            display_name: x.display_name,
          })),
          80,
        );
      }
    });

    await invalidatePropertyListCaches(redis);

    await appendAdminAuditLog({
      action: "board_variants.squares.put",
      targetType: "board_variant",
      targetId: variantId,
      payload: { overrideRows: inserts.length },
      req,
    });

    res.json({
      success: true,
      data: {
        variantId,
        overrideRows: inserts.length,
      },
    });
  } catch (err) {
    logger.error({ err }, "admin putBoardVariantSquares error");
    res.status(500).json({ success: false, error: "Failed to save square names" });
  }
}
