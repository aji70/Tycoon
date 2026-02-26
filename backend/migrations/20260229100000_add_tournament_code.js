/**
 * Add unique code to tournaments for shareable URLs (not predictable IDs).
 */
export const up = async (knex) => {
  await knex.schema.alterTable("tournaments", (table) => {
    table.string("code", 12).nullable().unique().after("id");
  });
  // Generate codes for existing tournaments
  const rows = await knex("tournaments").select("id");
  const crypto = await import("crypto");
  for (const row of rows) {
    const code = crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 10).toUpperCase();
    await knex("tournaments").where({ id: row.id }).update({ code });
  }
  await knex.schema.alterTable("tournaments", (table) => {
    table.string("code", 12).notNullable().unique().alter();
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable("tournaments", (table) => {
    table.dropColumn("code");
  });
};
