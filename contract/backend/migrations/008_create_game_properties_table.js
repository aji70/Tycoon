/**
 * Game Properties Table
 *
 * Tracks ownership of properties within a Monopoly game.
 *
 * Columns:
 * - id: Primary key
 * - game_id: FK → games.id
 * - player_id: FK → game_players.id (who owns the property)
 * - property_id: FK → properties.id (which property is owned)
 * - mortgaged: Boolean (default false)
 * - created_at / updated_at: Automatic timestamps
 *
 * Unique constraint: (game_id, property_id) ensures one property belongs
 * to exactly one player in a game.
 */

export const up = async (knex) => {
  return knex.schema.createTable("game_properties", (table) => {
    // Primary key
    table.increments("id").primary();

    // Game relation
    table.integer("game_id").unsigned().notNullable();

    // Player relation
    table.integer("player_id").unsigned().notNullable();

    // Property relation
    table.integer("property_id").unsigned().notNullable();

    // Property state
    table.boolean("mortgaged").notNullable().defaultTo(false);

    // Timestamps
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table
      .timestamp("updated_at")
      .defaultTo(knex.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));

    // Unique constraint (a property can only belong to one player per game)
    table.unique(["game_id", "property_id"]);
  });
};

export const down = async (knex) => {
  return knex.schema.dropTableIfExists("game_properties");
};
