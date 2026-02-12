/**
 * Track last turn_start when we recorded a timeout to avoid double-counting.
 * Used by record-timeout endpoint for multiplayer (3+ players) flow.
 */
exports.up = (knex) => {
  return knex.schema.table("game_players", (table) => {
    table.bigInteger("last_timeout_turn_start").unsigned().nullable();
  });
};

exports.down = (knex) => {
  return knex.schema.table("game_players", (table) => {
    table.dropColumn("last_timeout_turn_start");
  });
};
