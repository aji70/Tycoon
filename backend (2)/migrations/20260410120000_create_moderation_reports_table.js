/**
 * User/content reports for admin moderation queue.
 */

export const up = async (knex) => {
  await knex.schema.createTable("moderation_reports", (table) => {
    table.increments("id").primary();
    table.integer("reporter_user_id").unsigned().nullable();
    table.integer("target_user_id").unsigned().nullable();
    table.string("target_type", 32).notNullable().defaultTo("user");
    table.string("target_ref", 128).nullable();
    table.string("category", 64).notNullable();
    table.text("details").nullable();
    table.string("status", 32).notNullable().defaultTo("open").index();
    table.text("admin_note").nullable();
    table.timestamp("resolved_at").nullable();
    table.timestamps(true, true);

    table.index("created_at");
    table.index(["status", "created_at"]);

    table.foreign("reporter_user_id").references("id").inTable("users").onDelete("SET NULL");
    table.foreign("target_user_id").references("id").inTable("users").onDelete("SET NULL");
  });
};

export const down = async (knex) => {
  return knex.schema.dropTableIfExists("moderation_reports");
};
