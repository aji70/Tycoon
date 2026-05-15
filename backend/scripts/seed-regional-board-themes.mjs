/**
 * Upsert regional/thematic board variants and square display names.
 *
 * Usage (from backend/):
 *   node -r dotenv/config scripts/seed-regional-board-themes.mjs
 *
 * Requires DB migrations including board_variants & board_variant_square_names.
 */

import dotenv from "dotenv";
dotenv.config();

import db from "../config/database.js";
import { getRegionalBoardThemes } from "./regional-board-theme-templates.js";
import redis from "../config/redis.js";
import { invalidatePropertyListCaches } from "../utils/boardVariant.js";

const FLAG = "/game/go.svg";

async function upsertVariant(row) {
  await db.raw(
    `INSERT INTO board_variants (id, name, region, description, flag_url, property_count, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE name = VALUES(name), region = VALUES(region), description = VALUES(description),
       flag_url = VALUES(flag_url), property_count = VALUES(property_count), active = VALUES(active), updated_at = NOW()`,
    [
      row.id,
      row.name,
      row.region,
      row.description,
      FLAG,
      40,
      row.active !== false ? 1 : 0,
    ],
  );
}

async function replaceSquareNames(boardVariantId, names) {
  const canonical = await db("properties").whereNull("board_id").select("id", "name");
  const catalogMap = Object.fromEntries(canonical.map((p) => [Number(p.id), String(p.name ?? "")]));

  await db.transaction(async (trx) => {
    await trx("board_variant_square_names").where({ board_variant_id: boardVariantId }).del();
    const rows = [];
    for (let pid = 0; pid <= 39; pid += 1) {
      const display_name = names[pid];
      if (display_name == null || String(display_name).trim() === "") continue;
      const trimmed = String(display_name).trim();
      if (trimmed === catalogMap[pid]) continue;
      rows.push({
        board_variant_id: boardVariantId,
        property_id: pid,
        display_name: trimmed,
      });
    }
    if (rows.length) await trx.batchInsert("board_variant_square_names", rows, 80);
  });
}

async function main() {
  const themes = getRegionalBoardThemes();
  console.info(`Seeding ${themes.length} board themes…`);

  for (const t of themes) {
    await upsertVariant({
      id: t.id,
      name: t.name,
      region: t.region,
      description: t.description,
      active: true,
    });
    await replaceSquareNames(t.id, t.names);
    console.info(`  ✓ ${t.id}`);
  }

  try {
    await invalidatePropertyListCaches(redis);
    console.info("Redis property caches invalidated.");
  } catch (e) {
    console.warn("Redis invalidate skipped:", e?.message || e);
  }

  console.info("Done.");
  await db.destroy();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await db.destroy();
  } catch (_) {}
  process.exit(1);
});
