/**
 * Game Players Table
 *
 * Tracks the state of each player in a Monopoly game.
 *
 * Columns:
 * - id: Primary key
 * - game_id: FK → games.id
 * - user_id: FK → users.id (player identity)
 * - address: Optional wallet address for on-chain integration
 * - balance: Current money balance of the player
 * - position: Current board position (0 = GO, 39 = Boardwalk)
 * - turn_order: The order in which the player takes turns
 * - symbol: Limited to official Monopoly tokens (car, dog, hat, thimble, wheelbarrow, battleship, boot, iron, top_hat)
 * - chance_jail_card: Whether player owns a "Get Out of Jail Free" (Chance)
 * - community_chest_jail_card: Whether player owns a "Get Out of Jail Free" (Community Chest)
 * - created_at / updated_at: Automatic timestamps
 */

export const up = async (knex) => {
  return knex.schema.createTable("game_players", (table) => {
    // Primary key
    table.increments("id").primary();

    // Game relation
    table.integer("game_id").unsigned().notNullable();

    // Player relation
    table.integer("user_id").unsigned().notNullable();

    // Wallet address (optional for Web3 games)
    table.string("address", 120).nullable();

    // Economy
    table.integer("balance").notNullable().defaultTo(1500); // Standard starting cash

    // Game state
    table.integer("position").unsigned().notNullable().defaultTo(0); // Board index
    table.integer("turn_order").unsigned().nullable();

    // Player token
    table
      .enu("symbol", [
        "car",
        "dog",
        "hat",
        "thimble",
        "wheelbarrow",
        "battleship",
        "boot",
        "iron",
        "top_hat",
      ])
      .nullable();
    // Jail cards
    table.boolean("chance_jail_card").notNullable().defaultTo(false);
    table.boolean("community_chest_jail_card").notNullable().defaultTo(false);

    // Timestamps
    table.timestamps(true, true);
  });
};

export const down = async (knex) => {
  return knex.schema.dropTableIfExists("game_players");
};
