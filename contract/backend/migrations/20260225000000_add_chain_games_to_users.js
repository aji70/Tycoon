/**
 * Per-chain game stats for leaderboards.
 * - base_games_played, base_games_won
 * - celo_games_played, celo_games_won
 * - polygon_games_played, polygon_games_won
 */

export const up = async (knex) => {
  await knex.schema.alterTable("users", (table) => {
    table.integer("base_games_played").unsigned().notNullable().defaultTo(0);
    table.integer("base_games_won").unsigned().notNullable().defaultTo(0);
    table.integer("celo_games_played").unsigned().notNullable().defaultTo(0);
    table.integer("celo_games_won").unsigned().notNullable().defaultTo(0);
    table.integer("polygon_games_played").unsigned().notNullable().defaultTo(0);
    table.integer("polygon_games_won").unsigned().notNullable().defaultTo(0);
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("base_games_played");
    table.dropColumn("base_games_won");
    table.dropColumn("celo_games_played");
    table.dropColumn("celo_games_won");
    table.dropColumn("polygon_games_played");
    table.dropColumn("polygon_games_won");
  });
};
