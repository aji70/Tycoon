export const up = async (knex) => {
  // Create board_variants table
  await knex.schema.createTable("board_variants", (table) => {
    table.string("id").primary(); // kaduna-nigeria, ghana, kenya, etc.
    table.string("name").notNullable(); // "Kaduna", "Ghana", "Kenya"
    table.string("region").notNullable(); // "Nigeria", "West Africa", "East Africa"
    table.string("description").nullable(); // Detailed description
    table.string("flag_url").notNullable(); // /flags/kaduna.svg
    table.integer("property_count").defaultTo(40); // Number of properties on this board
    table.boolean("active").defaultTo(true); // Whether board is available for play
    table.timestamps(true, true); // created_at, updated_at
  });

  // Add board_id to properties table
  await knex.schema.table("properties", (table) => {
    table.string("board_id").nullable();
    table.foreign("board_id").references("id").inTable("board_variants").onDelete("cascade");
  });

  // Create index for faster queries
  await knex.schema.raw(`
    CREATE INDEX idx_properties_board_id ON properties(board_id, id);
  `);
};

export const down = async (knex) => {
  // Drop index
  await knex.schema.raw("DROP INDEX IF EXISTS idx_properties_board_id");

  // Remove board_id from properties
  await knex.schema.table("properties", (table) => {
    table.dropForeign("board_id");
    table.dropColumn("board_id");
  });

  // Drop board_variants table
  await knex.schema.dropTableIfExists("board_variants");
};
