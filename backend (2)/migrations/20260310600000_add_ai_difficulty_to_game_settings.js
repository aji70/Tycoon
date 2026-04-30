/**
 * Add ai_difficulty to game_settings for AI games.
 * Values: easy | hard | boss. Easy = built-in rules only; Hard = Claude; Boss = Claude (strongest).
 */

export const up = async (knex) => {
  if (!(await knex.schema.hasColumn("game_settings", "ai_difficulty"))) {
    await knex.schema.alterTable("game_settings", (table) => {
      table.string("ai_difficulty", 20).nullable().defaultTo("boss").comment("easy | hard | boss");
    });
  }
};

export const down = async (knex) => {
  if (await knex.schema.hasColumn("game_settings", "ai_difficulty")) {
    await knex.schema.alterTable("game_settings", (table) => table.dropColumn("ai_difficulty"));
  }
};
