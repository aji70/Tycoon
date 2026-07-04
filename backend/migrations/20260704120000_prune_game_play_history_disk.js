/**
 * Historical: one-time emergency prune when game_play_history filled the MySQL volume (Jul 2026).
 * Already applied on production — this is now a no-op so new deploys never auto-delete history.
 * Manual prune only: admin POST …/maintenance/prune-game-history or npm run prune-game-history
 */

/** @type {import('knex').Knex.MigratorConfig} */
export const config = { transaction: false };

export async function up() {
  console.log(
    "[migration] 20260704120000 — skipped (historical emergency prune; manual maintenance only)"
  );
}

export async function down() {
  // irreversible
}
