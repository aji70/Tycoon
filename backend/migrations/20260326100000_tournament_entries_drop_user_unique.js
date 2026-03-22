/**
 * Allow multiple tournament entries per user when they register different agents
 * (invited-bot / agents-only events). Uniqueness is enforced in application code:
 * one row per user_agent_id per tournament.
 */
export const up = async (knex) => {
  await knex.schema.alterTable("tournament_entries", (table) => {
    table.dropUnique(["tournament_id", "user_id"]);
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable("tournament_entries", (table) => {
    table.unique(["tournament_id", "user_id"]);
  });
};
