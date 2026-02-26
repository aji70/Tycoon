export const up = async (knex) => {
  await knex.schema.createTable("chats", (table) => {
    table.increments("id").primary();
    table.integer("game_id").unsigned().notNullable().index();
    table.enum("status", ["open", "close"]).defaultTo("open").notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("chats");
};
