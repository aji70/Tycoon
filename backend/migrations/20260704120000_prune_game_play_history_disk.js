/**
 * Free disk: prune finished-game rows from game_play_history (466k+ on prod).
 * Runs after 20260704110000 (table limits). Safe batches, no wrapping transaction.
 */
import { runGamePlayHistoryMaintenance } from "../services/gamePlayHistoryMaintenance.js";

/** @type {import('knex').Knex.MigratorConfig} */
export const config = { transaction: false };

export async function up(knex) {
  const client = knex.client.config.client;
  if (client !== "mysql" && client !== "mysql2") return;
  if (!(await knex.schema.hasTable("game_play_history"))) return;

  console.log("[migration] pruning game_play_history to free disk for rolls…");
  const result = await runGamePlayHistoryMaintenance({ aggressive: true });
  console.log("[migration] prune complete:", JSON.stringify(result));
}

export async function down() {
  // irreversible
}
