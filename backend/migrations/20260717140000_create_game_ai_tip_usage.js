/**
 * Track LLM tip usage per player per game (cap = AI_TIPS_PER_GAME, default 3).
 */

export const up = async (knex) => {
  await knex.schema.createTable("game_ai_tip_usage", (table) => {
    table.integer("game_id").unsigned().notNullable();
    table.integer("user_id").unsigned().notNullable();
    table.integer("tip_count").unsigned().notNullable().defaultTo(0);
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
    table.primary(["game_id", "user_id"]);
    table.index(["user_id"]);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("game_ai_tip_usage");
};
