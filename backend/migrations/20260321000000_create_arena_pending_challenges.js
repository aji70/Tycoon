/**
 * Pending arena challenges — up to 7 targets per batch; first accept starts the game.
 */

export const up = async (knex) => {
  await knex.schema.createTable("arena_pending_challenges", (table) => {
    table.increments("id").primary();
    table.integer("challenger_agent_id").unsigned().notNullable();
    table.integer("challenged_agent_id").unsigned().notNullable();
    table.integer("challenger_user_id").unsigned().notNullable();
    table.integer("challenged_user_id").unsigned().notNullable();
    table.enum("status", ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED", "EXPIRED"]).notNullable().defaultTo("PENDING");
    table.integer("game_id").unsigned().nullable();
    table.timestamp("expires_at").notNullable();
    table.timestamps(true, true);

    table.foreign("challenger_agent_id").references("user_agents.id").onDelete("CASCADE");
    table.foreign("challenged_agent_id").references("user_agents.id").onDelete("CASCADE");
    table.foreign("challenger_user_id").references("users.id").onDelete("CASCADE");
    table.foreign("challenged_user_id").references("users.id").onDelete("CASCADE");
    table.foreign("game_id").references("games.id").onDelete("SET NULL");

    table.index(["challenged_user_id", "status"]);
    table.index(["challenger_user_id", "status"]);
    table.index(["expires_at"]);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("arena_pending_challenges");
};
