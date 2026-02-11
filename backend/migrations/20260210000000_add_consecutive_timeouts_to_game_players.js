export const up = (knex) => {
  return knex.schema.table("game_players", (table) => {
    table.integer("consecutive_timeouts").unsigned().notNullable().defaultTo(0);
  });
};

export const down = (knex) => {
  return knex.schema.table("game_players", (table) => {
    table.dropColumn("consecutive_timeouts");
  });
};
