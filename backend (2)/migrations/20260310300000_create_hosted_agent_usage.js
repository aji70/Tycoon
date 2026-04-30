/**
 * Per-user daily usage for Tycoon-hosted agent decisions (cap on our API billing).
 */

export const up = async (knex) => {
  await knex.schema.createTable("hosted_agent_usage", (table) => {
    table.integer("user_id").unsigned().notNullable();
    table.date("usage_date").notNullable();
    table.integer("count").unsigned().notNullable().defaultTo(0);
    table.primary(["user_id", "usage_date"]);
    table.index("usage_date");
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("hosted_agent_usage");
};
