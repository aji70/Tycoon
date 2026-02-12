/**
 * Add turn_count column to game_players table
 * Tracks how many turns each player has taken (to prevent spam wins with < 20 turns)
 */

export const up = async (knex) => {
  return knex.schema.table("game_players", (table) => {
    table.integer("turn_count").unsigned().notNullable().defaultTo(0).after("consecutive_timeouts");
  });
};

export const down = async (knex) => {
  return knex.schema.table("game_players", (table) => {
    table.dropColumn("turn_count");
  });
};
