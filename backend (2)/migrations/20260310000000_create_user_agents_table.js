/**
 * User Agents table — stores agents created or connected by users.
 * Used for "My agents" and "use my agent to play Tycoon" (and later other use cases).
 * See docs/USER_AGENT_CREATION_SPEC.md.
 */

const STATUSES = ["draft", "active", "hosted", "error"];

export const up = async (knex) => {
  await knex.schema.createTable("user_agents", (table) => {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().index();
    table.foreign("user_id").references("users.id").onDelete("CASCADE");

    table.string("name", 255).notNullable();
    table.string("callback_url", 2048).nullable(); // bring-your-own agent URL
    table.json("config").nullable(); // for created agents: template, system_prompt, etc.
    table.enum("status", STATUSES).notNullable().defaultTo("draft");
    table.string("hosted_url", 2048).nullable(); // if we host: URL we give back
    table.string("erc8004_agent_id", 64).nullable();
    table.integer("chain_id").unsigned().nullable().defaultTo(42220);

    table.timestamps(true, true);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("user_agents");
};
