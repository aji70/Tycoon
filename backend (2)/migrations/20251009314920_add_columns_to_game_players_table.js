export const up = (knex) => {
  return knex.schema.table("game_players", (table) => {
    table.boolean("in_jail").notNullable().defaultTo(false);
    table.integer("in_jail_rolls").unsigned().defaultTo(0);
  });
};

export const down = (knex) => {
  return knex.schema.table("game_players", (table) => {
    table.dropColumn("in_jail");
    table.dropColumn("in_jail_rolls");
  });
};
