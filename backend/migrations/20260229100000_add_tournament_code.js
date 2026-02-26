/**
 * Add unique code to tournaments for shareable URLs (not predictable IDs).
 */
export const up = async (knex) => {
  await knex.schema.alterTable("tournaments", (table) => {
    table.string("code", 12).nullable().unique();
  });
  const rows = await knex("tournaments").select("id");
  const crypto = await import("crypto");
  const used = new Set();
  for (const row of rows) {
    let code;
    do {
      code = crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 10).toUpperCase();
    } while (used.has(code));
    used.add(code);
    await knex("tournaments").where({ id: row.id }).update({ code });
  }
  // Codes are now set for all existing rows; new tournaments get code on create
};

export const down = async (knex) => {
  await knex.schema.alterTable("tournaments", (table) => {
    table.dropColumn("code");
  });
};
