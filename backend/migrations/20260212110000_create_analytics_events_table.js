/**
 * Analytics events for dashboard and user feedback.
 * Store key actions (game_created, game_started, game_finished, error, etc.).
 */

export const up = async (knex) => {
  await knex.schema.createTable("analytics_events", (table) => {
    table.increments("id").primary();
    table.string("event_type", 64).notNullable().index();
    table.string("entity_type", 32).nullable(); // e.g. game, user
    table.integer("entity_id").unsigned().nullable();
    table.json("payload").nullable(); // optional extra data (no PII)
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.index("created_at");
  });
};

export const down = async (knex) => {
  return knex.schema.dropTableIfExists("analytics_events");
};
