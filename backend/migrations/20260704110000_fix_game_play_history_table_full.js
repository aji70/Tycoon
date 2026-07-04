/**
 * Railway/MySQL: game_play_history can hit "table is full" when the MySQL volume
 * is out of disk or the table has a MAX_ROWS cap (legacy MyISAM).
 *
 * Default: only lift table limits (ALTER) — no data deleted. Pair with expanding
 * your Railway MySQL volume if disk is full.
 *
 * Optional: set PRUNE_GAME_HISTORY=true when running migrate to delete old
 * finished-game history in small batches (slow; only if you cannot expand storage).
 *
 * CRITICAL: transaction must be false — bulk deletes in one txn exhaust undo log.
 */

/** @type {import('knex').Knex.MigratorConfig} */
export const config = { transaction: false };

const DELETE_BATCH = 100;
const LOG_EVERY_BATCHES = 50;

async function historyCount(knex) {
  const row = await knex("game_play_history").count("* as c").first();
  return Number(row?.c ?? 0);
}

async function deleteFinishedHistoryBatch(knex, { retentionDays = null } = {}) {
  let sql = `
    DELETE h FROM game_play_history h
    INNER JOIN games g ON g.id = h.game_id
    WHERE g.status IN ('FINISHED', 'CANCELLED')
  `;
  const bindings = [];
  if (retentionDays != null) {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
    bindings.push(cutoff.toISOString().slice(0, 19).replace("T", " "));
    sql += ` AND g.updated_at < ?`;
  }
  sql += ` LIMIT ?`;
  bindings.push(DELETE_BATCH);
  const [result] = await knex.raw(sql, bindings);
  return Number(result?.affectedRows ?? 0);
}

async function pruneFinishedGameHistory(knex, { retentionDays = null, label = "" } = {}) {
  let total = 0;
  let batches = 0;
  while (true) {
    const n = await deleteFinishedHistoryBatch(knex, { retentionDays });
    if (n === 0) break;
    total += n;
    batches += 1;
    if (batches % LOG_EVERY_BATCHES === 0) {
      console.log(
        `[migration] pruned ${total} history rows so far${label ? ` (${label})` : ""}…`
      );
    }
  }
  return total;
}

async function tryOptimize(knex, table) {
  try {
    await knex.raw("OPTIMIZE TABLE ??", [table]);
  } catch (_) {
    // best-effort
  }
}

async function tryAlterTable(knex, table) {
  try {
    await knex.raw("ALTER TABLE ?? MAX_ROWS=0 AVG_ROW_LENGTH=0", [table]);
    console.log(`[migration] ${table}: cleared MAX_ROWS cap`);
    return true;
  } catch (e) {
    console.warn(`[migration] MAX_ROWS alter on ${table}: ${e.message}`);
  }
  try {
    await knex.raw("ALTER TABLE ?? ENGINE=InnoDB ROW_FORMAT=DYNAMIC MAX_ROWS=0", [table]);
    console.log(`[migration] ${table}: converted to InnoDB`);
    return true;
  } catch (e) {
    console.warn(`[migration] InnoDB alter on ${table}: ${e.message}`);
    return false;
  }
}

export async function up(knex) {
  const client = knex.client.config.client;
  if (client !== "mysql" && client !== "mysql2") return;
  if (!(await knex.schema.hasTable("game_play_history"))) return;

  const before = await historyCount(knex);
  console.log(`[migration] game_play_history rows: ${before}`);

  // Fast path: remove artificial row caps / ensure InnoDB. No data loss.
  await tryAlterTable(knex, "game_play_history");

  const shouldPrune =
    process.env.PRUNE_GAME_HISTORY === "true" ||
    process.env.PRUNE_GAME_HISTORY === "1";

  if (shouldPrune) {
    console.log("[migration] PRUNE_GAME_HISTORY set — deleting old finished-game rows…");
    let pruned = await pruneFinishedGameHistory(knex, {
      retentionDays: 30,
      label: "finished/cancelled >30d",
    });
    console.log(`[migration] pruned ${pruned} rows (>30d)`);
    const mid = await historyCount(knex);
    if (mid > 50_000) {
      pruned = await pruneFinishedGameHistory(knex, { label: "all finished/cancelled" });
      console.log(`[migration] pruned ${pruned} more rows (all finished/cancelled)`);
    }
    await tryOptimize(knex, "game_play_history");
  } else {
    console.log(
      "[migration] skipped prune (default). Expand MySQL disk on Railway if inserts still fail with 'table is full'. Set PRUNE_GAME_HISTORY=true only if you cannot expand."
    );
  }

  await tryAlterTable(knex, "game_play_history");
  console.log(`[migration] game_play_history rows after fix: ${await historyCount(knex)}`);
}

export async function down() {
  // No safe rollback — previous engine/limits are unknown.
}
