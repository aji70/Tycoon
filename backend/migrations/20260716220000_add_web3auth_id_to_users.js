/**
 * Add web3auth_id for Web3Auth-authenticated users (replaces Privy as primary social login).
 * Existing privy_did rows remain valid; email link on first Web3Auth sign-in migrates accounts.
 */
export async function up(knex) {
  await knex.schema.alterTable("users", (table) => {
    table.string("web3auth_id", 512).nullable().unique();
  });
}

export async function down(knex) {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("web3auth_id");
  });
}
