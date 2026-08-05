/**
 * Multi-chain (Celo + Stellar) fields for wa-ramp.
 */

export const up = async (knex) => {
  if (await knex.schema.hasTable("wa_ramp_users")) {
    if (!(await knex.schema.hasColumn("wa_ramp_users", "stellar_wallet"))) {
      await knex.schema.alterTable("wa_ramp_users", (t) => {
        t.string("stellar_wallet", 64).nullable();
      });
    }
  }
  if (await knex.schema.hasTable("wa_ramp_orders")) {
    if (!(await knex.schema.hasColumn("wa_ramp_orders", "chain"))) {
      await knex.schema.alterTable("wa_ramp_orders", (t) => {
        t.string("chain", 16).notNullable().defaultTo("celo");
      });
    }
  }
};

export const down = async (knex) => {
  if (await knex.schema.hasTable("wa_ramp_orders") && (await knex.schema.hasColumn("wa_ramp_orders", "chain"))) {
    await knex.schema.alterTable("wa_ramp_orders", (t) => t.dropColumn("chain"));
  }
  if (await knex.schema.hasTable("wa_ramp_users") && (await knex.schema.hasColumn("wa_ramp_users", "stellar_wallet"))) {
    await knex.schema.alterTable("wa_ramp_users", (t) => t.dropColumn("stellar_wallet"));
  }
};
