/**
 * Add unique code to tournaments for shareable URLs (not predictable IDs).
 * Idempotent: skips adding column if it already exists, backfills only null codes.
 */
export const up = async (knex) => {
  const hasCode = await knex.schema.hasColumn("tournaments", "code");
  if (!hasCode) {
    await knex.schema.alterTable("tournaments", (table) => {
      table.string("code", 12).nullable().unique();
    });
  }
  const rows = await knex("tournaments").select("id", "code").whereNull("code");
  if (rows.length === 0) return;
  const crypto = await import("crypto");
  const existing = await knex("tournaments").select("code");
  const used = new Set(existing.map((r) => r.code).filter(Boolean));
  for (const row of rows) {
    let code;
    do {
      code = crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 10).toUpperCase();
    } while (used.has(code));
    used.add(code);
    await knex("tournaments").where({ id: row.id }).update({ code });
  }
};

export const down = async (knex) => {
  await knex.schema.alterTable("tournaments", (table) => {
    table.dropColumn("code");
  });
};
