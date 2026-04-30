/**
 * Track last turn_start when we recorded a timeout to avoid double-counting.
 * Used by record-timeout endpoint for multiplayer (3+ players) flow.
 */
export const up = async (knex) => {
  const hasColumn = await knex.schema.hasColumn("game_players", "last_timeout_turn_start");
  if (hasColumn) return;
  return knex.schema.table("game_players", (table) => {
    table.bigInteger("last_timeout_turn_start").unsigned().nullable();
  });
};

export const down = async (knex) => {
  const hasColumn = await knex.schema.hasColumn("game_players", "last_timeout_turn_start");
  if (!hasColumn) return;
  return knex.schema.table("game_players", (table) => {
    table.dropColumn("last_timeout_turn_start");
  });
};
