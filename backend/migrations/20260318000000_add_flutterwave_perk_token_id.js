/**
 * Single-perk NGN purchases via Flutterwave (separate table to avoid altering bundle flow).
 */
export async function up(knex) {
  await knex.schema.createTableIfNotExists("flutterwave_perk_payments", (table) => {
    table.string("tx_ref", 128).primary();
    table.integer("user_id").unsigned().notNullable();
    table.string("token_id", 78).notNullable().comment("Collectible token ID (bigint as string)");
    table.decimal("amount_ngn", 12, 2).notNullable();
    table.integer("amount_kobo").unsigned().notNullable();
    table.string("status", 20).notNullable().defaultTo("pending");
    table.dateTime("fulfilled_at").nullable();
    table.timestamps(true, true);
    table.foreign("user_id").references("users.id").onDelete("CASCADE");
    table.index(["user_id", "status"]);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("flutterwave_perk_payments");
}
