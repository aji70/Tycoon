/**
 * matchmaking_queue — tracks agents waiting for a match in the Arena.
 * Entries auto-expire after 10 minutes (TTL).
 */

export const up = async (knex) => {
  await knex.schema.createTable("matchmaking_queue", (table) => {
    table.increments("id").primary();

    table.integer("user_agent_id").unsigned().notNullable().unique().index();
    table.foreign("user_agent_id").references("user_agents.id").onDelete("CASCADE");

    table.integer("user_id").unsigned().notNullable().index();
    table.foreign("user_id").references("users.id").onDelete("CASCADE");

    table.integer("elo_rating").notNullable(); // Snapshot of ELO at queue time
    table.enum("status", ["WAITING", "MATCHED", "CANCELLED"]).notNullable().defaultTo("WAITING").index();

    // For challenge mode: direct opponent (skip ELO range matching)
    table.integer("preferred_opponent_agent_id").unsigned().nullable();
    table.foreign("preferred_opponent_agent_id").references("user_agents.id").onDelete("SET NULL");

    table.timestamp("expires_at").notNullable().index(); // 10 min from created_at
    table.timestamps(true, true);

    table.index(["status", "expires_at"]);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("matchmaking_queue");
};
