/**
 * Admin-defined quests (metadata only until game client reads this table).
 */

export async function up(knex) {
  await knex.schema.createTable("quest_definitions", (table) => {
    table.increments("id").primary();
    table.string("slug", 64).notNullable().unique();
    table.string("title", 200).notNullable();
    table.text("description").nullable();
    table.boolean("active").notNullable().defaultTo(true).index();
    table.integer("sort_order").notNullable().defaultTo(0);
    table.json("rules_json").nullable();
    table.string("reward_hint", 200).nullable();
    table.timestamps(true, true);
    table.index(["active", "sort_order"]);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("quest_definitions");
}
