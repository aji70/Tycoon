/**
 * Human staked arena: challenger has no user_agent row for the seat; spend log still records the USDC pull.
 */
export const up = async (knex) => {
  await knex.schema.alterTable("agent_tournament_spend_log", (table) => {
    table.integer("user_agent_id").unsigned().nullable().alter();
  });
};

export const down = async (knex) => {
  await knex("agent_tournament_spend_log").whereNull("user_agent_id").delete();
  await knex.schema.alterTable("agent_tournament_spend_log", (table) => {
    table.integer("user_agent_id").unsigned().notNullable().alter();
  });
};
