/**
 * Add ai_difficulty_mode and ai_difficulty_per_slot to game_settings.
 * - ai_difficulty_mode: "same" | "random" (default "random") — whether all AIs share one difficulty or each gets a random one
 * - ai_difficulty_per_slot: JSON object mapping slot (2-8) -> "easy"|"hard"|"boss", e.g. {"2":"easy","3":"boss","4":"hard"}
 */

export const up = async (knex) => {
  if (!(await knex.schema.hasColumn("game_settings", "ai_difficulty_mode"))) {
    await knex.schema.alterTable("game_settings", (table) => {
      table.string("ai_difficulty_mode", 20).nullable().defaultTo("random").comment("same | random");
    });
  }
  if (!(await knex.schema.hasColumn("game_settings", "ai_difficulty_per_slot"))) {
    await knex.schema.alterTable("game_settings", (table) => {
      table.json("ai_difficulty_per_slot").nullable().comment('{"2":"easy","3":"boss",...}');
    });
  }
};

export const down = async (knex) => {
  if (await knex.schema.hasColumn("game_settings", "ai_difficulty_mode")) {
    await knex.schema.alterTable("game_settings", (table) => table.dropColumn("ai_difficulty_mode"));
  }
  if (await knex.schema.hasColumn("game_settings", "ai_difficulty_per_slot")) {
    await knex.schema.alterTable("game_settings", (table) => table.dropColumn("ai_difficulty_per_slot"));
  }
};
