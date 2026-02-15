/**
 * Add trade_locked_balance to game_players.
 * When a player offers cash in a trade, that amount is locked here.
 * On accept: lock is released and balance is transferred.
 * On decline/expire: lock is released (refund).
 */
export const up = async (knex) => {
  await knex.schema.alterTable("game_players", (table) => {
    table.decimal("trade_locked_balance", 15, 2).defaultTo(0).notNullable();
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable("game_players", (table) => {
    table.dropColumn("trade_locked_balance");
  });
};
