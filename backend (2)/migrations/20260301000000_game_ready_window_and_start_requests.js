/**
 * In-game "Start now" (all players must click within 30s to start).
 * - games.ready_window_opens_at: when the 30s window opens (e.g. when last player joined).
 * - game_start_requests: who clicked "Start now" and when (to transition PENDING → RUNNING).
 */
export const up = async (knex) => {
  await knex.schema.alterTable("games", (table) => {
    table.timestamp("ready_window_opens_at").nullable().comment("When the 30s ready window opens (UTC); for tournament games");
  });

  await knex.schema.createTable("game_start_requests", (table) => {
    table.increments("id").primary();
    table.integer("game_id").unsigned().notNullable();
    table.integer("user_id").unsigned().notNullable();
    table.timestamp("requested_at").notNullable();
    table.timestamps(true, true);
    table.foreign("game_id").references("games.id").onDelete("CASCADE");
    table.foreign("user_id").references("users.id").onDelete("CASCADE");
    table.unique(["game_id", "user_id"]);
    table.index(["game_id"]);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("game_start_requests");
  await knex.schema.alterTable("games", (table) => {
    table.dropColumn("ready_window_opens_at");
  });
};
