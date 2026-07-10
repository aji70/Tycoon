/**
 * Human PvP challenges from the online list.
 */
export const up = async (knex) => {
  const exists = await knex.schema.hasTable("player_challenges");
  if (exists) return;

  await knex.schema.createTable("player_challenges", (table) => {
    table.increments("id").primary();
    table.integer("challenger_id").unsigned().notNullable().index();
    table.integer("opponent_id").unsigned().notNullable().index();
    table.integer("game_id").unsigned().nullable().index();
    table.string("game_code", 32).notNullable().index();
    table
      .enum("status", ["pending", "accepted", "rejected", "cancelled", "expired"])
      .notNullable()
      .defaultTo("pending")
      .index();
    table.timestamp("expires_at").nullable().index();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("player_challenges");
};
