export const up = async (knex) => {
  const exists = await knex.schema.hasTable("users");

  if (!exists) {
    return knex.schema.createTable("wallets", (table) => {
      table.increments("id").primary();
      table.integer("user_id").unsigned();
      table.decimal("available_balance", 18, 2).defaultTo(0);
      table.decimal("locked_balance", 18, 2).defaultTo(0);
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
  return knex.schema.dropTableIfExists("wallets");
};
