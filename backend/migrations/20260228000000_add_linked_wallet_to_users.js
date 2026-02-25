/**
 * Add linked_wallet_address and linked_wallet_chain for guest ↔ wallet linking.
 * When a guest links a wallet, we store it here; resolve user by address or linked address.
 */
export const up = async (knex) => {
  await knex.schema.alterTable("users", (table) => {
    table.string("linked_wallet_address", 120).nullable();
    table.string("linked_wallet_chain", 50).nullable();
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("linked_wallet_address");
    table.dropColumn("linked_wallet_chain");
  });
};
