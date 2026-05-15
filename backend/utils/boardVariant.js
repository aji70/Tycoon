import db from "../config/database.js";

export const DEFAULT_BOARD_ID = "default";

/**
 * Normalize and validate board variant for a new game. Unknown or inactive ids fall back to default.
 */
export async function resolveBoardIdForGame(raw) {
  const id =
    raw == null || String(raw).trim() === ""
      ? DEFAULT_BOARD_ID
      : String(raw).trim().toLowerCase();
  if (id === DEFAULT_BOARD_ID) return DEFAULT_BOARD_ID;
  const row = await db("board_variants").where({ id, active: true }).first();
  return row ? id : DEFAULT_BOARD_ID;
}

export async function findActiveBoardVariants() {
  return db("board_variants").where({ active: true }).orderBy("name", "asc");
}

export async function getSquareNameMap(boardVariantId) {
  if (!boardVariantId || boardVariantId === DEFAULT_BOARD_ID) return new Map();
  const rows = await db("board_variant_square_names").where({ board_variant_id: boardVariantId });
  const m = new Map();
  for (const r of rows) m.set(Number(r.property_id), r.display_name);
  return m;
}

export async function mergeCanonicalPropertiesWithVariant(canonicalRows, boardVariantId) {
  const map = await getSquareNameMap(boardVariantId);
  if (map.size === 0) return canonicalRows;
  return canonicalRows.map((p) => {
    const alt = map.get(Number(p.id));
    return alt ? { ...p, name: alt } : p;
  });
}

/** Invalidate cached property lists for each known variant (call after mutating properties). */
export async function invalidatePropertyListCaches(redis) {
  const ids = await db("board_variants").select("id");
  const keys = new Set(["properties:v1:default", "properties"]);
  for (const r of ids) keys.add(`properties:v1:${r.id}`);
  for (const k of keys) {
    try {
      await redis.del(k);
    } catch {
      /* ignore */
    }
  }
}
