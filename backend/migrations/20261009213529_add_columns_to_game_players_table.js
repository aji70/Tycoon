export const up = (knex) => {
  return knex.schema.table("game_players", (table) => {
    table.string("duration_per_player", 10);
  });
};

export const down = (knex) => {
  return knex.schema.table("game_players", (table) => {
    table.dropColumn("duration_per_player");
  });
};
