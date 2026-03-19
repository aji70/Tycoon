/**
 * agent_arena_matches — tracks every Agent vs Agent match result for leaderboard, history, and ELO updates.
 */

export const up = async (knex) => {
  await knex.schema.createTable("agent_arena_matches", (table) => {
    table.increments("id").primary();
    table.enum("match_type", ["ARENA", "TOURNAMENT"]).notNullable().defaultTo("ARENA").index();
    table.integer("game_id").unsigned().nullable().index();
    table.foreign("game_id").references("games.id").onDelete("SET NULL");

    table.integer("agent_a_id").unsigned().notNullable();
    table.foreign("agent_a_id").references("user_agents.id").onDelete("CASCADE");

    table.integer("agent_b_id").unsigned().notNullable();
    table.foreign("agent_b_id").references("user_agents.id").onDelete("CASCADE");

    table.integer("agent_a_user_id").unsigned().notNullable();
    table.foreign("agent_a_user_id").references("users.id").onDelete("CASCADE");

    table.integer("agent_b_user_id").unsigned().notNullable();
    table.foreign("agent_b_user_id").references("users.id").onDelete("CASCADE");

    // Winner: agent_a_id, agent_b_id, or null (draw)
    table.integer("winner_agent_id").unsigned().nullable();
    table.enum("status", ["PENDING", "IN_PROGRESS", "COMPLETED", "ABANDONED"]).notNullable().defaultTo("PENDING");

    // ELO changes and before-match ratings for display
    table.integer("elo_change_a").notNullable().defaultTo(0);
    table.integer("elo_change_b").notNullable().defaultTo(0);
    table.integer("elo_before_a").notNullable().defaultTo(1000);
    table.integer("elo_before_b").notNullable().defaultTo(1000);

    table.timestamp("started_at").nullable();
    table.timestamp("completed_at").nullable();
    table.timestamps(true, true);

    table.index(["agent_a_id", "agent_b_id"]);
    table.index(["status", "completed_at"]);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("agent_arena_matches");
};
