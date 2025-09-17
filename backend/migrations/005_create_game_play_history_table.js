/**
 * Game Play History Table
 *
 * Logs every action taken by players in a game.
 *
 * Columns:
 * - id: Primary key
 * - game_id: FK → games.id
 * - game_player_id: FK → game_players.id
 * - rolled: Dice result (0–12)
 * - old_position: Board index before move (0–39)
 * - new_position: Board index after move (0–39)
 * - action: ENUM of action type (MOVE, PAY_RENT, BUY_PROPERTY, etc.)
 * - amount: Money involved in the action (+ for credit, - for debit)
 * - extra: JSON metadata for flexible details (property_id, card_drawn, etc.)
 * - comment: Optional human-readable log
 * - created_at / updated_at: Automatic timestamps
 */

export const up = async (knex) => {
  return knex.schema.createTable("game_play_history", (table) => {
    // Primary key
    table.increments("id").primary();

    // Relation to games
    table.integer("game_id").unsigned().notNullable();

    // Relation to game_players
    table.integer("game_player_id").unsigned().notNullable();

    // Dice roll
    table.tinyint("rolled").unsigned().nullable(); // 0–12

    // Movement
    table.integer("old_position").unsigned().nullable(); // 0–39
    table.integer("new_position").unsigned().nullable(); // 0–39

    // Action type
    table
      .enu("action", [
        "MOVE",
        "PAY_RENT",
        "BUY_PROPERTY",
        "SELL_PROPERTY",
        "MORTGAGE_PROPERTY",
        "UNMORTGAGE_PROPERTY",
        "DRAW_CHANCE",
        "DRAW_COMMUNITY_CHEST",
        "GO_TO_JAIL",
        "GET_OUT_OF_JAIL",
        "PASS_GO",
        "TRADE",
        "BANKRUPT",
        "OTHER",
      ])
      .notNullable();

    // Economy
    table.integer("amount").defaultTo(0); // +/- for debit/credit

    // Flexible metadata
    table.json("extra").nullable();

    // Free-form notes
    table.text("comment").nullable();

    // Timestamps
    table.timestamps(true, true);
  });
};

export const down = async (knex) => {
  return knex.schema.dropTableIfExists("game_play_history");
};
