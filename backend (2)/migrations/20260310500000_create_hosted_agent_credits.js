/**
 * Purchasable hosted agent credits.
 * - hosted_agent_credits: user_id (PK), balance, updated_at
 * - hosted_agent_credit_purchases: audit log (user_id, credits, price_usdc/price_ngn, source, tx_hash/tx_ref)
 * - hosted_agent_credits_ngn_pending: pending NGN purchases (tx_ref, user_id, credits, amount_ngn, status)
 */

export const up = async (knex) => {
  await knex.schema.createTable("hosted_agent_credits", (table) => {
    table.integer("user_id").unsigned().primary();
    table.foreign("user_id").references("users.id").onDelete("CASCADE");
    table.integer("balance").unsigned().notNullable().defaultTo(0);
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("hosted_agent_credit_purchases", (table) => {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().index();
    table.foreign("user_id").references("users.id").onDelete("CASCADE");
    table.integer("credits").unsigned().notNullable();
    table.decimal("price_usdc", 24, 6).nullable().comment("If paid with USDC");
    table.decimal("price_ngn", 12, 2).nullable().comment("If paid with NGN");
    table.string("source", 20).notNullable().comment("usdc | ngn");
    table.string("tx_hash", 128).nullable().index().comment("On-chain tx hash for USDC");
    table.string("tx_ref", 128).nullable().index().comment("Flutterwave tx_ref for NGN");
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("hosted_agent_credits_ngn_pending", (table) => {
    table.string("tx_ref", 128).primary();
    table.integer("user_id").unsigned().notNullable();
    table.foreign("user_id").references("users.id").onDelete("CASCADE");
    table.integer("credits").unsigned().notNullable();
    table.decimal("amount_ngn", 12, 2).notNullable();
    table.string("status", 20).notNullable().defaultTo("pending").comment("pending | completed | failed");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("hosted_agent_credits_ngn_pending");
  await knex.schema.dropTableIfExists("hosted_agent_credit_purchases");
  await knex.schema.dropTableIfExists("hosted_agent_credits");
};
