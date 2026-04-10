/**
 * Append-only log for dashboard admin actions (shared-secret auth; no per-admin id yet).
 */

export const up = async (knex) => {
  await knex.schema.createTable("admin_audit_log", (table) => {
    table.increments("id").primary();
    table.string("action", 96).notNullable().index();
    table.string("target_type", 32).nullable().index();
    table.string("target_id", 64).nullable();
    table.json("payload_json").nullable();
    table.string("ip", 45).nullable();
    table.string("user_agent", 512).nullable();
    table.timestamp("created_at").defaultTo(knex.fn.now()).index();
    table.index(["action", "created_at"]);
  });
};

export const down = async (knex) => {
  return knex.schema.dropTableIfExists("admin_audit_log");
};
