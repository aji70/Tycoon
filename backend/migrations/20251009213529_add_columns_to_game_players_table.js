export const up = (knex) => {
  return knex.schema.table("game_players", (table) => {
    table.string("rolls", 10);
  });
};

export const down = (knex) => {
  return knex.schema.table("game_players", (table) => {
    table.dropColumn("rolls");
  });
};
