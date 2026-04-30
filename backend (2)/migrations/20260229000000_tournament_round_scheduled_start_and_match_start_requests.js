/**
 * Tournament: per-round scheduled start time + "Start now" tracking.
 * - tournament_rounds.scheduled_start_at: when the 5-min window opens for that round
 * - tournament_match_start_requests: who clicked "Start now" and when (for forfeit / game creation)
 */
export const up = async (knex) => {
  await knex.schema.alterTable("tournament_rounds", (table) => {
    table.timestamp("scheduled_start_at").nullable().comment("When the 5-min start window opens (UTC)");
  });

  await knex.schema.createTable("tournament_match_start_requests", (table) => {
    table.increments("id").primary();
    table.integer("match_id").unsigned().notNullable();
    table.integer("entry_id").unsigned().notNullable();
    table.timestamp("requested_at").notNullable();
    table.timestamps(true, true);
    table.foreign("match_id").references("tournament_matches.id").onDelete("CASCADE");
    table.foreign("entry_id").references("tournament_entries.id").onDelete("CASCADE");
    table.unique(["match_id", "entry_id"]);
    table.index(["match_id"]);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("tournament_match_start_requests");
  await knex.schema.alterTable("tournament_rounds", (table) => {
    table.dropColumn("scheduled_start_at");
  });
};
