export const up = async (knex) => {
  const exists = await knex.schema.hasTable("users");

  if (!exists) {
    return knex.schema.createTable("tokens", (table) => {
      table.increments("id").primary();
      table.string("address", 255);
      table.string("symbol", 255);
      table.string("name", 255);
      table.integer("decimals");
      table.string("logo_url", 255);
      table.string("chain", 255);
      table.decimal("price", 18, 8).defaultTo(0);
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at").defaultTo(knex.fn.now());
    });
  }
};

export const down = async (knex) => {
  return knex.schema.dropTableIfExists("tokens");
};
