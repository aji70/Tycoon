/**
 * Add smart_wallet_address to users (TycoonUserRegistry wallet per player).
 * Filled after on-chain registration when User Registry is set; optionally synced from chain later.
 */
export const up = async (knex) => {
  await knex.schema.alterTable("users", (table) => {
    table.string("smart_wallet_address", 120).nullable();
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("smart_wallet_address");
  });
};
