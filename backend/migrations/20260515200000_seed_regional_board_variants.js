/**
 * Seed regional/thematic board variants (square display names only).
 * Mirrors scripts/seed-regional-board-themes.mjs so deploys get full theme list without a manual seed step.
 */

import { getRegionalBoardThemes } from "../scripts/regional-board-theme-templates.js";

const FLAG = "/game/go.svg";

async function upsertVariant(knex, row) {
  await knex.raw(
    `INSERT INTO board_variants (id, name, region, description, flag_url, property_count, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE name = VALUES(name), region = VALUES(region), description = VALUES(description),
       flag_url = VALUES(flag_url), property_count = VALUES(property_count), active = VALUES(active), updated_at = NOW()`,
    [row.id, row.name, row.region, row.description, FLAG, 40, row.active ? 1 : 0],
  );
}

export const up = async (knex) => {
  const hasSquareNames = await knex.schema.hasTable("board_variant_square_names");
  if (!hasSquareNames) {
    throw new Error("board_variant_square_names missing — run 20260515180000_board_variant_square_names first");
  }

  const themes = getRegionalBoardThemes();
  const canonical = await knex("properties").whereNull("board_id").select("id", "name");
  const catalogMap = Object.fromEntries(canonical.map((p) => [Number(p.id), String(p.name ?? "")]));

  for (const t of themes) {
    await upsertVariant(knex, {
      id: t.id,
      name: t.name,
      region: t.region,
      description: t.description,
      active: true,
    });

    for (let pid = 0; pid <= 39; pid += 1) {
      const display_name = t.names[pid];
      if (display_name == null || String(display_name).trim() === "") continue;
      const trimmed = String(display_name).trim();
      if (trimmed === catalogMap[pid]) continue;

      await knex.raw(
        `INSERT INTO board_variant_square_names (board_variant_id, property_id, display_name)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
        [t.id, pid, trimmed],
      );
    }
  }
};

export const down = async (knex) => {
  const ids = getRegionalBoardThemes().map((t) => t.id);
  await knex("board_variant_square_names").whereIn("board_variant_id", ids).del();
  await knex("board_variants").whereIn("id", ids).del();
};
