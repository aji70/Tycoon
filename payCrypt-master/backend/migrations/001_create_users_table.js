export const up = async (knex) => {
  const exists = await knex.schema.hasTable("users");

  if (!exists) {
    return knex.schema.createTable("users", (table) => {
      table.increments("id").primary();
      table.string("tag", 100).unique().notNullable();
      table.string("email", 100).unique().notNullable();
      table.string("password", 255).notNullable();
      table.string("address", 255).notNullable();
      table.string("kyc_status", 255).defaultTo("none");
      table.string("role", 255).defaultTo("user");
      table.string("photo", 255);
      table.boolean("is_verified").defaultTo(false);
      table.timestamp("last_login").defaultTo(knex.fn.now());
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at").defaultTo(knex.fn.now());
      table.index("tag");
    });
  }
};

export const down = async (knex) => {
  return knex.schema.dropTableIfExists("users");
};
