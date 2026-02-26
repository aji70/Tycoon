export const up = async (knex) => {
  await knex.schema.createTable("properties", (table) => {
    table.integer("id").primary(); // Auto-incrementing ID

    // Core attributes
    table.string("type").notNullable(); // property | corner | special
    table.string("name").notNullable();
    table.integer("group_id").defaultTo(0);

    // Positioning
    table.string("position").notNullable(); // bottom | left | top | right
    table.integer("grid_row").notNullable();
    table.integer("grid_col").notNullable();

    // Economics
    table.integer("price").defaultTo(0);
    table.integer("rent_site_only").defaultTo(0);
    table.integer("rent_one_house").defaultTo(0);
    table.integer("rent_two_houses").defaultTo(0);
    table.integer("rent_three_houses").defaultTo(0);
    table.integer("rent_four_houses").defaultTo(0);
    table.integer("rent_hotel").defaultTo(0);
    table.integer("cost_of_house").defaultTo(0);

    // State
    table.boolean("is_mortgaged").defaultTo(false);

    // UI fields
    table.string("color", 10).defaultTo("#FFFFFF"); // Hex color code
    table.string("icon").nullable(); // image url
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("properties");
};
