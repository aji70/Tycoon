/**
 * One row per user_agent: which arena/tournament-bot game currently holds the bot.
 * Used with reconcile + stale timeout instead of inferring busy state from assignments alone.
 */

export const up = async (knex) => {
  await knex.schema.createTable("arena_agent_challenge_locks", (table) => {
    table.integer("user_agent_id").unsigned().primary();
    table.integer("game_id").unsigned().notNullable().index();
    table.timestamp("locked_at").notNullable().defaultTo(knex.fn.now());
    table.timestamps(true, true);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("arena_agent_challenge_locks");
};
