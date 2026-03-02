/**
 * Add lobby (global) chat support:
 * - chats: slug column (nullable), game_id nullable for lobby row
 * - messages: user_id column (nullable) for lobby messages
 * - Insert lobby chat row
 */
export const up = async (knex) => {
  if (!(await knex.schema.hasColumn("chats", "slug"))) {
    await knex.schema.alterTable("chats", (table) => {
      table.string("slug", 64).nullable().index();
    });
  }
  // Make game_id nullable so we can have a lobby chat without a game (index already exists)
  const client = knex.client.config.client;
  if (client === "mysql" || client === "mysql2") {
    await knex.raw("ALTER TABLE ?? MODIFY COLUMN ?? INT UNSIGNED NULL", ["chats", "game_id"]);
  } else {
    await knex.schema.alterTable("chats", (table) => {
      table.integer("game_id").unsigned().nullable().alter();
    });
  }
  const hasLobby = await knex("chats").where({ slug: "lobby" }).first();
  if (!hasLobby) {
    await knex("chats").insert({ game_id: null, status: "open", slug: "lobby" });
  }
  if (!(await knex.schema.hasColumn("messages", "user_id"))) {
    await knex.schema.alterTable("messages", (table) => {
      table.integer("user_id").unsigned().nullable().index();
    });
  }
};

export const down = async (knex) => {
  await knex("chats").where({ slug: "lobby" }).del();
  await knex.schema.alterTable("chats", (table) => {
    table.dropColumn("slug");
  });
  const client = knex.client.config.client;
  if (client === "mysql" || client === "mysql2") {
    await knex.raw("ALTER TABLE ?? MODIFY COLUMN ?? INT UNSIGNED NOT NULL", ["chats", "game_id"]);
  } else {
    await knex.schema.alterTable("chats", (table) => {
      table.integer("game_id").unsigned().notNullable().alter();
    });
  }
  if (await knex.schema.hasColumn("messages", "user_id")) {
    await knex.schema.alterTable("messages", (table) => table.dropColumn("user_id"));
  }
};
