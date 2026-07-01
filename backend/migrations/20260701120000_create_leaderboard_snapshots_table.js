/**
 * Daily UTC leaderboard snapshots — rankings refresh once per day at midnight UTC.
 */
export async function up(knex) {
  await knex.schema.createTableIfNotExists("leaderboard_snapshots", (table) => {
    table.increments("id").primary();
    table.string("cache_key", 191).notNullable();
    table.date("snapshot_date").notNullable().comment("UTC calendar date this snapshot is valid for");
    table.text("payload").notNullable().comment("JSON array of leaderboard rows");
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["cache_key", "snapshot_date"]);
    table.index(["snapshot_date"]);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("leaderboard_snapshots");
}
