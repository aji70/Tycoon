export const up = async (knex) => {
  const exists = await knex.schema.hasTable("users");

  if (!exists) {
    return knex.schema.createTable("bank_accounts", (table) => {
      table.increments("id").primary();
      table.integer("user_id").unsigned().notNullable();
      table.string("bank_code", 255);
      table.string("bank_name", 255);
      table.string("account_number", 255);
      table.string("account_name", 255);
      table.string("account_id", 255);
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at").defaultTo(knex.fn.now());

      table
        .foreign("user_id")
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table.index("user_id");
    });
  }
};

export const down = async (knex) => {
  return knex.schema.dropTableIfExists("bank_accounts");
};
