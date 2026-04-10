/**
 * Append-only log for referral attach attempts (success + failures) for fraud review and analytics.
 */

export async function up(knex) {
  await knex.schema.createTable("referral_events", (table) => {
    table.increments("id").primary();
    table.integer("referee_user_id").unsigned().notNullable().index();
    table.string("event_type", 32).notNullable().index();
    table.integer("referrer_user_id").unsigned().nullable().index();
    table.string("code_normalized", 32).nullable();
    table.string("failure_reason", 32).nullable();
    table.string("source", 16).notNullable().defaultTo("unknown");
    table.json("metadata").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["created_at"]);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("referral_events");
}
