export const up = async (knex) => {
  const exists = await knex.schema.hasTable("users");

  if (!exists) {
    return knex.schema.createTable("transactions", (table) => {
      table.increments("id").primary();
      table.integer("user_id").unsigned();
      table.integer("token_id").unsigned();
      table.integer("chain_id").unsigned();
      table.string("reference", 255);
      table.string("type", 255);
      table.string("status", 255).defaultTo("completed");
      table.string("tx_hash", 255);
      table.decimal("usd_value", 18, 3).defaultTo(0);
      table.decimal("amount", 18, 8).defaultTo(0);
      table.string("timestamp", 255);
      table.string("from_address", 255);
      table.string("to_address", 255);
      table.text("description");
      table.text("extra");
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
  return knex.schema.dropTableIfExists("transactions");
};
