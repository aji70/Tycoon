/**
 * Game Settings Table
 *
 * Stores configuration for each Monopoly game.
 *
 * Columns:
 * - id: Primary key
 * - game_id: FK → games.id (each game has one set of rules/settings)
 * - auction: Whether auctioning is enabled
 * - rent_in_prison: Whether players can collect rent while in prison
 * - mortgage: Whether mortgages are allowed
 * - even_build: Whether houses must be built evenly across properties
 * - randomize_play_order: Whether player order is randomized
 * - starting_cash: Starting money each player receives
 * - created_at / updated_at: Automatic timestamps
 */

export const up = async (knex) => {
  return knex.schema.createTable("game_settings", (table) => {
    // Primary key
    table.increments("id").primary();

    // Game relation
    table.integer("game_id").unsigned().notNullable();

    // Game rule toggles
    table.boolean("auction").notNullable().defaultTo(false);
    table.boolean("rent_in_prison").notNullable().defaultTo(false);
    table.boolean("mortgage").notNullable().defaultTo(false);
    table.boolean("even_build").notNullable().defaultTo(false);
    table.boolean("randomize_play_order").notNullable().defaultTo(false);

    // Game economy
    table.integer("starting_cash").unsigned().notNullable().defaultTo(1500);

    // Timestamps
    table.timestamps(true, true);
  });
};

export const down = async (knex) => {
  return knex.schema.dropTableIfExists("game_settings");
};
