/**
 * Add optional API key storage to user_agents (encrypted at rest).
 * Used for "call agent via API key" when user has no callback URL.
 */

export const up = async (knex) => {
  await knex.schema.alterTable("user_agents", (table) => {
    table.string("provider", 64).nullable(); // e.g. "anthropic"
    table.text("api_key_encrypted").nullable(); // encrypted with AGENT_API_KEY_SECRET
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable("user_agents", (table) => {
    table.dropColumn("provider");
    table.dropColumn("api_key_encrypted");
  });
};
