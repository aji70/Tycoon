/**
 * Agent tournament permissions + bindings.
 *
 * Enables a user to authorize one of their agents to:
 * - auto-register for tournaments (optionally paying entry fee from smart wallet)
 * - auto-request match start during the tournament window
 *
 * Security: the permission is explicit + capped (max entry fee, optional daily cap).
 */
export const up = async (knex) => {
  if (!(await knex.schema.hasTable("agent_tournament_permissions"))) {
    await knex.schema.createTable("agent_tournament_permissions", (table) => {
      table.increments("id").primary();
      table.integer("user_id").unsigned().notNullable().index();
      table.integer("user_agent_id").unsigned().notNullable().index();
      table.boolean("enabled").notNullable().defaultTo(false).index();
      // USDC units (6 decimals) stored as string to avoid JS precision issues.
      table.string("max_entry_fee_usdc", 64).notNullable().defaultTo("0");
      table.string("daily_cap_usdc", 64).nullable(); // null = no daily cap
      table.string("chain", 16).nullable().index(); // null = any chain
      table.timestamps(true, true);
      table.unique(["user_id", "user_agent_id"]);
    });
  }

  if (!(await knex.schema.hasTable("tournament_entry_agents"))) {
    await knex.schema.createTable("tournament_entry_agents", (table) => {
      table.increments("id").primary();
      table.integer("tournament_entry_id").unsigned().notNullable().unique().index();
      table.integer("user_agent_id").unsigned().notNullable().index();
      table.string("agent_name", 128).nullable();
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable("agent_tournament_spend_log"))) {
    await knex.schema.createTable("agent_tournament_spend_log", (table) => {
      table.increments("id").primary();
      table.integer("user_id").unsigned().notNullable().index();
      table.integer("user_agent_id").unsigned().notNullable().index();
      table.integer("tournament_id").unsigned().nullable().index();
      table.string("chain", 16).nullable().index();
      table.string("amount_usdc", 64).notNullable().defaultTo("0");
      table.string("tx_hash", 128).nullable();
      table.string("status", 16).notNullable().defaultTo("SUBMITTED").index(); // SUBMITTED|CONFIRMED|FAILED
      table.text("error").nullable();
      table.timestamps(true, true);
    });
  }
};

export const down = async (knex) => {
  if (await knex.schema.hasTable("agent_tournament_spend_log")) {
    await knex.schema.dropTable("agent_tournament_spend_log");
  }
  if (await knex.schema.hasTable("tournament_entry_agents")) {
    await knex.schema.dropTable("tournament_entry_agents");
  }
  if (await knex.schema.hasTable("agent_tournament_permissions")) {
    await knex.schema.dropTable("agent_tournament_permissions");
  }
};

