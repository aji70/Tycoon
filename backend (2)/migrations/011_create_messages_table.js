export const up = async (knex) => {
  return knex.schema.createTable("messages", (table) => {
    // Primary key
    table.increments("id").primary();
    table.integer("chat_id").unsigned().notNullable().index();
    table.string("player_id").nullable();
    table.text("body").nullable();
    // Timestamps
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table
      .timestamp("updated_at")
      .defaultTo(knex.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));
  });
};

export const down = async (knex) => {
  return knex.schema.dropTableIfExists("messages");
};
