/**
 * Users Table
 *
 * Stores player information for the Monopoly game.
 *
 * Columns:
 * - id: Primary key
 * - username: Unique display name for the player
 * - address: Wallet address (unique identifier for blockchain integration)
 * - chain: Blockchain network identifier (default: "BASE")
 * - games_played: Total games played by the user
 * - game_won: Total games won
 * - game_lost: Total games lost
 * - total_staked: Total amount the user has staked in the game (currency/points)
 * - total_earned: Total rewards earned
 * - total_withdrawn: Total withdrawn rewards
 * - created_at: Record creation timestamp
 * - updated_at: Record last update timestamp
 */

export const up = async (knex) => {
  return knex.schema.createTable("users", (table) => {
    // Primary key
    table.increments("id").primary();

    // Identity
    table.string("username", 100).notNullable().unique();
    table.string("address", 100).notNullable().unique();
    table.string("chain", 50).notNullable().defaultTo("BASE");

    // Gameplay stats
    table.integer("games_played").unsigned().notNullable().defaultTo(0);
    table.integer("game_won").unsigned().notNullable().defaultTo(0);
    table.integer("game_lost").unsigned().notNullable().defaultTo(0);

    // Financial stats (DECIMAL(20, 8) allows for large values + crypto precision)
    table.decimal("total_staked", 20, 8).notNullable().defaultTo(0);
    table.decimal("total_earned", 20, 8).notNullable().defaultTo(0);
    table.decimal("total_withdrawn", 20, 8).notNullable().defaultTo(0);

    // Timestamps (auto managed)
    table.timestamps(true, true);

    // Indexes
    table.index(["address", "chain"]);
  });
};

export const down = async (knex) => {
  return knex.schema.dropTable("users");
};
