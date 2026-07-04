import db from "../config/database.js";

export const DEFAULT_BOARD_ID = "default";

// Board variants are tiny, rarely-changing reference tables but are consulted on
// hot paths (property lists, history remaps, game creation). Memoize briefly.
const MEMO_TTL_MS = 60 * 1000;
const memo = new Map(); // key -> { at, value }

async function memoized(key, loader) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.value;
  const value = await loader();
  memo.set(key, { at: Date.now(), value });
  return value;
}

/** Drop in-process board-variant memos (call after admin edits). */
export function clearBoardVariantMemo() {
  memo.clear();
}

/**
 * Normalize and validate board variant for a new game. Unknown or inactive ids fall back to default.
 */
export async function resolveBoardIdForGame(raw) {
  const id =
    raw == null || String(raw).trim() === ""
      ? DEFAULT_BOARD_ID
      : String(raw).trim().toLowerCase();
  if (id === DEFAULT_BOARD_ID) return DEFAULT_BOARD_ID;
  const activeIds = await memoized("activeIds", async () => {
    const rows = await db("board_variants").where({ active: true }).select("id");
    return new Set(rows.map((r) => String(r.id)));
  });
  return activeIds.has(id) ? id : DEFAULT_BOARD_ID;
}

export async function findActiveBoardVariants() {
  return memoized("activeList", () =>
    db("board_variants").where({ active: true }).orderBy("name", "asc")
  );
}

export async function getSquareNameMap(boardVariantId) {
  if (!boardVariantId || boardVariantId === DEFAULT_BOARD_ID) return new Map();
  return memoized(`squares:${boardVariantId}`, async () => {
    const rows = await db("board_variant_square_names").where({ board_variant_id: boardVariantId });
    const m = new Map();
    for (const r of rows) m.set(Number(r.property_id), r.display_name);
    return m;
  });
}

export async function mergeCanonicalPropertiesWithVariant(canonicalRows, boardVariantId) {
  const map = await getSquareNameMap(boardVariantId);
  if (map.size === 0) return canonicalRows;
  return canonicalRows.map((p) => {
    const alt = map.get(Number(p.id));
    return alt ? { ...p, name: alt } : p;
  });
}

/** Display name for a catalog property row (sync; pass map from getSquareNameMap). */
export function propertyDisplayName(property, nameMap) {
  if (!property) return "";
  const alt = nameMap?.get(Number(property.id));
  return alt ?? String(property.name ?? "");
}

export async function propertyDisplayNameForBoard(property, boardId) {
  if (!property) return "";
  const map = await getSquareNameMap(boardId);
  return propertyDisplayName(property, map);
}

function remapTextWithReplacements(text, replacements) {
  if (text == null || replacements.length === 0) return text;
  let out = String(text);
  for (const [from, to] of replacements) {
    if (from && to && from !== to) out = out.split(from).join(to);
  }
  return out;
}

/** Canonical name → themed name pairs, longest first (safe substring replace in comments). */
export async function buildPropertyNameReplacements(boardId) {
  const id = boardId == null || String(boardId).trim() === "" ? DEFAULT_BOARD_ID : String(boardId).trim().toLowerCase();
  if (id === DEFAULT_BOARD_ID) return [];
  return memoized(`replacements:${id}`, async () => {
    const map = await getSquareNameMap(id);
    if (map.size === 0) return [];
    const canonical = await db("properties").whereNull("board_id").select("id", "name");
    const replacements = [];
    for (const p of canonical) {
      const alt = map.get(Number(p.id));
      if (alt && alt !== p.name) replacements.push([String(p.name), String(alt)]);
    }
    replacements.sort((a, b) => b[0].length - a[0].length);
    return replacements;
  });
}

/** Apply board theme names to stored history comments (and extra.description). */
export async function remapHistoryForBoardVariant(history, boardId) {
  if (!Array.isArray(history) || history.length === 0) return history ?? [];
  const replacements = await buildPropertyNameReplacements(boardId);
  if (replacements.length === 0) return history;
  return history.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const next = { ...entry };
    if (next.comment != null) {
      next.comment = remapTextWithReplacements(next.comment, replacements);
    }
    if (next.extra != null) {
      const wasString = typeof next.extra === "string";
      try {
        const ex = wasString ? JSON.parse(next.extra) : { ...next.extra };
        if (ex && typeof ex === "object" && ex.description != null) {
          ex.description = remapTextWithReplacements(ex.description, replacements);
          next.extra = wasString ? JSON.stringify(ex) : ex;
        }
      } catch {
        /* keep original extra */
      }
    }
    return next;
  });
}

/** Invalidate cached property lists for each known variant (call after mutating properties). */
export async function invalidatePropertyListCaches(redis) {
  clearBoardVariantMemo();
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
