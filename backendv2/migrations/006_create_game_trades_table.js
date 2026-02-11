/**
 * Game Trades Table
 *
 * Represents a proposed or completed trade between two players in a Monopoly game.
 *
 * Columns:
 * - id: Primary key
 * - game_id: FK → games.id
 * - from_player_id: FK → game_players.id (initiator of trade)
 * - to_player_id: FK → game_players.id (recipient of trade)
 * - type: Enum → CASH, PROPERTY, MIXED
 * - status: Enum → PENDING, ACCEPTED, REJECTED, COUNTERED
 * - sending_amount: Cash offered by from_player
 * - receiving_amount: Cash requested from to_player
 * - created_at / updated_at: Automatic timestamps
 */

export const up = async (knex) => {
  return knex.schema.createTable("game_trades", (table) => {
    // Primary key
    table.increments("id").primary();

    // Game relation
    table.integer("game_id").unsigned().notNullable();
    // Players
    table.integer("from_player_id").unsigned().notNullable();

    table.integer("to_player_id").unsigned().notNullable();
    // Trade details
    table
      .enum("type", ["CASH", "PROPERTY", "MIXED"])
      .notNullable()
      .defaultTo("MIXED");

    table
      .enum("status", ["PENDING", "ACCEPTED", "REJECTED", "COUNTERED"])
      .notNullable()
      .defaultTo("PENDING");

    table.decimal("sending_amount", 12, 2).notNullable().defaultTo(0);
    table.decimal("receiving_amount", 12, 2).notNullable().defaultTo(0);

    // Timestamps
    table.timestamp("created_at").defaultTo(knex.fn.now());

    table
      .timestamp("updated_at")
      .defaultTo(knex.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));
  });
};

export const down = async (knex) => {
  return knex.schema.dropTableIfExists("game_trades");
};
