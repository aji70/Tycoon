/**
 * Games Table
 *
 * Stores active and historical Monopoly games.
 *
 * Columns:
 * - id: Primary key
 * - code: Unique game code for joining a session
 * - mode: Game mode (e.g., PUBLIC, PRIVATE)
 * - creator_id: User who created the game (FK → users.id)
 * - status: Current state of the game (PENDING, RUNNING, FINISHED, CANCELLED)
 * - winner_id: User who won the game (FK → users.id, nullable)
 * - number_of_players: Maximum number of players (default 4)
 * - next_player_id: Current player’s turn (FK → users.id, nullable)
 * - created_at / updated_at: Automatic timestamps
 */

export const up = async (knex) => {
  return knex.schema.createTable("games", (table) => {
    // Primary key
    table.increments("id").primary();

    // Game identity
    table.string("code", 100).notNullable().unique();
    // Game Mode
    table.enu("mode", ["PUBLIC", "PRIVATE"]).notNullable().defaultTo("PUBLIC");

    // Relationships
    table.integer("creator_id").unsigned().notNullable();

    // Game status
    table
      .enu("status", ["PENDING", "RUNNING", "FINISHED", "CANCELLED"])
      .notNullable()
      .defaultTo("PENDING");

    // Winner (nullable)
    table.integer("winner_id").unsigned().nullable();

    // Game settings
    table.integer("number_of_players").unsigned().notNullable().defaultTo(4);

    // Turn tracking
    table.integer("next_player_id").unsigned().nullable();

    // Timestamps (created_at, updated_at)
    table.timestamps(true, true);
  });
};

export const down = async (knex) => {
  return knex.schema.dropTableIfExists("games");
};
