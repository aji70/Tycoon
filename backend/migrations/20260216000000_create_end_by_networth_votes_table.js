/**
 * End-by-networth votes: for untimed games, players can vote to end the game by net worth.
 * When all players have voted yes, the game ends (winner = highest net worth).
 * Votes are cleared when any player rolls dice.
 */
export const up = (knex) => {
  return knex.schema.createTable("end_by_networth_votes", (table) => {
    table.increments("id").primary();
    table.integer("game_id").unsigned().notNullable();
    table.integer("user_id").unsigned().notNullable(); // Player who voted to end by net worth
    table.timestamp("created_at").defaultTo(knex.fn.now());

    table.unique(["game_id", "user_id"]);
    table.index("game_id");
    table.foreign("game_id").references("games.id").onDelete("CASCADE");
    table.foreign("user_id").references("users.id").onDelete("CASCADE");
  });
};

export const down = (knex) => {
  return knex.schema.dropTableIfExists("end_by_networth_votes");
};
