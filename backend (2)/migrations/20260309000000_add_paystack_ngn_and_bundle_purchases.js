/**
 * Add NGN pricing and Paystack payment tracking for perk bundles.
 * - perk_bundles: price_ngn (numeric, Naira)
 * - paystack_payments: pending/completed Paystack transactions (reference, user_id, bundle_id, etc.)
 * - user_bundle_purchases: fulfilled NGN purchases (for in-game grant or future contract mint)
 */
export async function up(knex) {
  if (!(await knex.schema.hasColumn("perk_bundles", "price_ngn"))) {
    await knex.schema.alterTable("perk_bundles", (table) => {
      table.decimal("price_ngn", 12, 2).nullable().defaultTo(null).comment("Price in Naira (e.g. 50)");
    });
  }

  await knex.schema.createTableIfNotExists("paystack_payments", (table) => {
    table.string("reference", 64).primary().comment("Paystack transaction reference");
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

  await knex.schema.createTableIfNotExists("user_bundle_purchases", (table) => {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable();
    table.integer("bundle_id").unsigned().notNullable();
    table.string("payment_reference", 64).nullable().comment("Paystack reference for NGN; null for other sources");
    table.string("source", 20).notNullable().defaultTo("ngn").comment("ngn | tyc | usdc | contract");
    table.timestamps(true, true);
    table.foreign("user_id").references("users.id").onDelete("CASCADE");
    table.foreign("bundle_id").references("perk_bundles.id").onDelete("RESTRICT");
    table.index(["user_id"]);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("user_bundle_purchases");
  await knex.schema.dropTableIfExists("paystack_payments");
  if (await knex.schema.hasColumn("perk_bundles", "price_ngn")) {
    await knex.schema.alterTable("perk_bundles", (table) => table.dropColumn("price_ngn"));
  }
}
