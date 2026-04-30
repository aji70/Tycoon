/**
 * Add withdrawal_pin_hash to users for 2FA on smart-wallet withdrawals.
 * Backend verifies PIN before signing withdrawal auth; contract requires that signature.
 */

export const up = async (knex) => {
  const hasColumn = await knex.schema.hasColumn("users", "withdrawal_pin_hash");
  if (!hasColumn) {
    await knex.schema.alterTable("users", (table) => {
      table.string("withdrawal_pin_hash", 255).nullable().comment("bcrypt hash of user PIN for withdrawal auth");
    });
  }
};

export const down = async (knex) => {
  if (await knex.schema.hasColumn("users", "withdrawal_pin_hash")) {
    await knex.schema.alterTable("users", (table) => {
      table.dropColumn("withdrawal_pin_hash");
    });
  }
};
