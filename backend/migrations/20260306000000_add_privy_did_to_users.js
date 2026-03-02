/**
 * Add privy_did to users for Privy-authenticated users (sign-in with email/social).
 * When set, the user was created via Privy; address may be a placeholder until wallet is linked.
 */
export function up(knex) {
  return knex.schema.alterTable("users", (table) => {
    table.string("privy_did", 255).nullable().unique();
  });
}

export function down(knex) {
  return knex.schema.alterTable("users", (table) => {
    table.dropColumn("privy_did");
  });
}
