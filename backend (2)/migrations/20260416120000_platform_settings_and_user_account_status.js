/**
 * platform_settings: DB-backed flags (maintenance, economy overrides).
 * users.account_status: active | suspended | banned (enforced in auth middleware).
 */

export async function up(knex) {
  const hasPs = await knex.schema.hasTable("platform_settings");
  if (!hasPs) {
    await knex.schema.createTable("platform_settings", (table) => {
      table.string("setting_key", 128).primary();
      table.text("value_json").notNullable();
      table.timestamp("updated_at").defaultTo(knex.fn.now());
    });
  }

  const hasCol = await knex.schema.hasColumn("users", "account_status");
  if (!hasCol) {
    await knex.schema.table("users", (table) => {
      table.string("account_status", 16).notNullable().defaultTo("active");
      table.index(["account_status"], "users_account_status_idx");
    });
  }
}

export async function down(knex) {
  const hasCol = await knex.schema.hasColumn("users", "account_status");
  if (hasCol) {
    await knex.schema.table("users", (table) => {
      table.dropColumn("account_status");
    });
  }
  const hasPs = await knex.schema.hasTable("platform_settings");
  if (hasPs) {
    await knex.schema.dropTableIfExists("platform_settings");
  }
}
