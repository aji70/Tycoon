/**
 * Add Flutterwave payment tracking for NGN perk bundle purchases.
 * flutterwave_payments: pending/completed Flutterwave transactions (tx_ref, user_id, bundle_id, etc.)
 */
export async function up(knex) {
  await knex.schema.createTableIfNotExists("flutterwave_payments", (table) => {
    table.string("tx_ref", 128).primary().comment("Flutterwave transaction reference");
    table.integer("user_id").unsigned().notNullable();
    table.integer("bundle_id").unsigned().notNullable();
    table.integer("amount_kobo").unsigned().notNullable();
    table.string("status", 20).notNullable().defaultTo("pending").comment("pending | completed | failed");
    table.dateTime("fulfilled_at").nullable();
    table.timestamps(true, true);
    table.foreign("user_id").references("users.id").onDelete("CASCADE");
    table.foreign("bundle_id").references("perk_bundles.id").onDelete("RESTRICT");
    table.index(["user_id", "status"]);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("flutterwave_payments");
}
