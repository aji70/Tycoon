/**
 * Track one-time promo claims for perk purchases.
 */
export async function up(knex) {
  await knex.schema.createTableIfNotExists("perk_purchase_promos", (table) => {
    table.increments("id").primary();
    table.string("promo_type", 64).notNullable();
    table.string("claim_key", 191).notNullable().unique();
    table.integer("user_id").unsigned().notNullable();
    table.string("token_id", 78).notNullable().comment("Collectible token ID (bigint as string)");
    table.string("chain", 20).notNullable().defaultTo("CELO");
    table.string("delivery_address", 64).notNullable();
    table.string("source", 40).notNullable().defaultTo("unknown");
    table.string("purchase_tx_hash", 80).nullable();
    table.string("payment_ref", 128).nullable();
    table.string("bonus_tx_hash", 80).nullable();
    table.string("status", 20).notNullable().defaultTo("pending");
    table.text("error_message").nullable();
    table.dateTime("completed_at").nullable();
    table.timestamps(true, true);
    table.foreign("user_id").references("users.id").onDelete("CASCADE");
    table.index(["user_id", "promo_type"]);
    table.index(["status", "created_at"]);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("perk_purchase_promos");
}
