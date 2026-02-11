/**
 * Game Trade Items Table
 *
 * Tracks properties involved in trades between players.
 *
 * Columns:
 * - id: Primary key
 * - trade_id: FK → game_trades.id
 * - property_id: FK → properties.id
 * - player_id: FK → game_players.id (who contributed the property)
 * - created_at / updated_at: Automatic timestamps
 */

export const up = async (knex) => {
  return knex.schema.createTable("game_trade_items", (table) => {
    // Primary key
    table.increments("id").primary();

    // Trade relation
    table.integer("trade_id").unsigned().notNullable();

    // Property relation
    table.integer("property_id").unsigned().notNullable();

    // Player relation
    table.integer("player_id").unsigned().notNullable();

    // Timestamps
    table.timestamp("created_at").defaultTo(knex.fn.now());

    table
      .timestamp("updated_at")
      .defaultTo(knex.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));

    // Ensure a property can't appear twice in the same trade
    table.unique(["trade_id", "property_id"]);
  });
};

export const down = async (knex) => {
  return knex.schema.dropTableIfExists("game_trade_items");
};
