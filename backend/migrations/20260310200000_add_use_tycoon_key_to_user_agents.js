/**
 * Add use_tycoon_key for Tycoon-hosted agents (we run the AI with our key).
 */

export const up = async (knex) => {
  await knex.schema.alterTable("user_agents", (table) => {
    table.boolean("use_tycoon_key").notNullable().defaultTo(false);
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable("user_agents", (table) => {
    table.dropColumn("use_tycoon_key");
  });
};
