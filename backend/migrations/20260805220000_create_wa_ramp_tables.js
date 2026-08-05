/**
 * WhatsApp USDC ↔ NGN on/off-ramp (wa-ramp) tables.
 */

export const up = async (knex) => {
  if (!(await knex.schema.hasTable("wa_ramp_users"))) {
    await knex.schema.createTable("wa_ramp_users", (table) => {
      table.increments("id").primary();
      table.string("phone", 32).notNullable().unique();
      table.string("wallet", 42).nullable();
      table.string("bank_name", 64).nullable();
      table.string("bank_account", 32).nullable();
      table.string("account_name", 128).nullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at").defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable("wa_ramp_orders"))) {
    await knex.schema.createTable("wa_ramp_orders", (table) => {
      table.increments("id").primary();
      table.string("ref", 32).notNullable().unique();
      table.string("type", 8).notNullable(); // buy | sell
      table.string("phone", 32).notNullable().index();
      table.decimal("amount_usdc", 18, 6).notNullable();
      table.integer("amount_ngn").unsigned().notNullable();
      table.integer("rate").unsigned().notNullable();
      table.string("status", 32).notNullable().index();
      table.string("deposit_address", 42).nullable();
      table.string("wallet", 42).nullable();
      table.string("payout_bank_name", 64).nullable();
      table.string("payout_bank_account", 32).nullable();
      table.string("payout_account_name", 128).nullable();
      table.string("tx_hash", 66).nullable();
      table.timestamp("expires_at").nullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at").defaultTo(knex.fn.now());
    });
  }
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("wa_ramp_orders");
  await knex.schema.dropTableIfExists("wa_ramp_users");
};
