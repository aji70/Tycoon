/**
 * Add bank account fields for CELO→Naira payouts (Flutterwave transfer).
 * User sets these in Profile; backend uses them when processing naira withdrawal.
 */

export const up = async (knex) => {
  if (!(await knex.schema.hasColumn("users", "bank_account_number"))) {
    await knex.schema.alterTable("users", (table) => {
      table.string("bank_account_number", 32).nullable().comment("Nigerian bank account number for Naira payouts");
    });
  }
  if (!(await knex.schema.hasColumn("users", "bank_code"))) {
    await knex.schema.alterTable("users", (table) => {
      table.string("bank_code", 16).nullable().comment("Flutterwave bank code (e.g. 044 for Access)");
    });
  }
};

export const down = async (knex) => {
  if (await knex.schema.hasColumn("users", "bank_account_number")) {
    await knex.schema.alterTable("users", (table) => table.dropColumn("bank_account_number"));
  }
  if (await knex.schema.hasColumn("users", "bank_code")) {
    await knex.schema.alterTable("users", (table) => table.dropColumn("bank_code"));
  }
};
