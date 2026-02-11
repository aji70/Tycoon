export const up = async (knex) => {
  await knex.schema.createTable("game_trade_requests", (table) => {
    table.increments("id").primary();
    table.integer("game_id").unsigned().notNullable().index();
    table.integer("player_id").unsigned().notNullable().index();
    table.integer("target_player_id").unsigned().notNullable().index();

    // Use JSON columns for property arrays
    table.json("offer_properties").nullable();
    table.decimal("offer_amount", 15, 2).defaultTo(0.0);

    table.json("requested_properties").nullable();
    table.decimal("requested_amount", 15, 2).defaultTo(0.0);

    table
      .enum("status", ["accepted", "declined", "counter", "pending"])
      .defaultTo("pending")
      .notNullable();

    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("game_trade_requests");
};
