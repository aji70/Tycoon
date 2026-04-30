/**
 * Add guest user support: password_hash (for contract auth) and is_guest flag.
 */
export function up(knex) {
  return knex.schema.alterTable("users", (table) => {
    table.string("password_hash", 66).nullable(); // keccak256 hex
    table.boolean("is_guest").notNullable().defaultTo(false);
  });
}

export function down(knex) {
  return knex.schema.alterTable("users", (table) => {
    table.dropColumn("password_hash");
    table.dropColumn("is_guest");
  });
}
