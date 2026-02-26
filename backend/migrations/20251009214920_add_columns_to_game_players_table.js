export const up = (knex) => {
  return knex.schema.table("game_players", (table) => {
    table.integer("circle").defaultTo(0);
  });
};

export const down = (knex) => {
  return knex.schema.table("game_players", (table) => {
    table.dropColumn("circle");
  });
};
