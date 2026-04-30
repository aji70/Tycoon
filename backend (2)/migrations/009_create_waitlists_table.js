export const up = async (knex) => {
  return knex.schema.createTable("waitlists", (table) => {
    // Primary key
    table.increments("id").primary();
    table.string("wallet_address").nullable();
    table.string("email_address").nullable();
    table.string("telegram_username").nullable();
    // Timestamps
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table
      .timestamp("updated_at")
      .defaultTo(knex.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));
  });
};

export const down = async (knex) => {
  return knex.schema.dropTableIfExists("waitlists");
};
