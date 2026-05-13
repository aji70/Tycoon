export const up = async (knex) => {
  return knex.schema.table("games", (table) => {
    table.string("board_id", 50).notNullable().defaultTo("default");
    table.index("board_id");
  });
};

export const down = async (knex) => {
  return knex.schema.table("games", (table) => {
    table.dropIndex("board_id");
    table.dropColumn("board_id");
  });
};
