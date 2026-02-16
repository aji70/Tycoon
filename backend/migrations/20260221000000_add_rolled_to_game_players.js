/**
 * Add rolled column to game_players.
 * rolled = dice total for current turn (2–12); null until player rolls, cleared on end turn.
 */

export const up = (knex) => {
  return knex.schema.table("game_players", (table) => {
    table.tinyint("rolled").unsigned().nullable();
  });
};

export const down = (knex) => {
  return knex.schema.table("game_players", (table) => {
    table.dropColumn("rolled");
  });
};
