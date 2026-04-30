/**
 * Pending "Buy CELO with Naira" payments. When Flutterwave webhook confirms,
 * backend calls vault.creditCelo(smart_wallet_address, amount_celo_wei).
 */

export const up = async (knex) => {
  await knex.schema.createTable("celo_purchase_ngn_pending", (table) => {
    table.string("tx_ref", 128).primary().comment("Flutterwave tx_ref");
    table.integer("user_id").unsigned().notNullable();
    table.foreign("user_id").references("users.id").onDelete("CASCADE");
    table.string("smart_wallet_address", 42).notNullable().comment("Recipient for creditCelo");
    table.decimal("amount_ngn", 12, 2).notNullable();
    table.string("amount_celo_wei", 78).notNullable().comment("Quoted CELO in wei (fixed at init)");
    table.string("status", 20).notNullable().defaultTo("pending").comment("pending | completed | failed");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("celo_purchase_ngn_pending");
};
