/**
 * Add trade_locked_balance to game_players.
 * Tracks cash reserved for pending trades so it cannot be spent until the trade completes or is cancelled.
 */
export function up(knex) {
  return knex.schema.alterTable("game_players", (table) => {
    table.integer("trade_locked_balance").unsigned().notNullable().defaultTo(0);
  });
}

export function down(knex) {
  return knex.schema.alterTable("game_players", (table) => {
    table.dropColumn("trade_locked_balance");
  });
}
