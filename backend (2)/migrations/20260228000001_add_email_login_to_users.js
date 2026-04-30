/**
 * Add email login and verification fields (Phase 3: connect email, verify, login with email).
 */
export const up = async (knex) => {
  await knex.schema.alterTable("users", (table) => {
    table.string("email", 255).nullable().unique();
    table.boolean("email_verified").notNullable().defaultTo(false);
    table.string("password_hash_email", 255).nullable(); // bcrypt
    table.string("email_verification_token", 64).nullable();
    table.timestamp("email_verification_expires_at").nullable();
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("email");
    table.dropColumn("email_verified");
    table.dropColumn("password_hash_email");
    table.dropColumn("email_verification_token");
    table.dropColumn("email_verification_expires_at");
  });
};
