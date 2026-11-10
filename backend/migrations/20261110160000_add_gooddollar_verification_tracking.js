/**
 * Track when users start Face Verify from Tycoon and when we first see them
 * whitelisted on-chain (attribution for GoodBuilders / our own analytics).
 */
export async function up(knex) {
  const hasStarted = await knex.schema.hasColumn("users", "gd_fv_started_at");
  if (!hasStarted) {
    await knex.schema.alterTable("users", (table) => {
      table.timestamp("gd_fv_started_at").nullable();
    });
  }
  const hasVerified = await knex.schema.hasColumn("users", "gd_verified_at");
  if (!hasVerified) {
    await knex.schema.alterTable("users", (table) => {
      table.timestamp("gd_verified_at").nullable().index();
    });
  }
}

export async function down(knex) {
  const hasVerified = await knex.schema.hasColumn("users", "gd_verified_at");
  if (hasVerified) {
    await knex.schema.alterTable("users", (table) => {
      table.dropColumn("gd_verified_at");
    });
  }
  const hasStarted = await knex.schema.hasColumn("users", "gd_fv_started_at");
  if (hasStarted) {
    await knex.schema.alterTable("users", (table) => {
      table.dropColumn("gd_fv_started_at");
    });
  }
}
