/**
 * All-time leaderboard snapshots exceed MySQL TEXT (64KB). Use LONGTEXT.
 */
export async function up(knex) {
  const client = knex.client.config.client;
  if (client === "mysql" || client === "mysql2") {
    await knex.raw("ALTER TABLE leaderboard_snapshots MODIFY payload LONGTEXT NOT NULL");
    return;
  }
  if (client === "pg" || client === "postgresql") {
    await knex.raw("ALTER TABLE leaderboard_snapshots ALTER COLUMN payload TYPE TEXT");
  }
}

export async function down(knex) {
  const client = knex.client.config.client;
  if (client === "mysql" || client === "mysql2") {
    await knex.raw("ALTER TABLE leaderboard_snapshots MODIFY payload TEXT NOT NULL");
  }
}
