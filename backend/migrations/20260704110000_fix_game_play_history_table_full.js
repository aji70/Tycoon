/**
 * Railway/MySQL: game_play_history hits "The table 'game_play_history' is full"
 * at ~2000 rows on MyISAM (same MAX_ROWS cap as chats). Rolls fail because every
 * move inserts a history row. Must DELETE rows before ALTER.
 */

const BATCH = 500;
const ROW_CAP_THRESHOLD = 1900;

async function historyCount(knex) {
  const row = await knex("game_play_history").count("* as c").first();
  return Number(row?.c ?? 0);
}

async function pruneTerminalGameHistory(knex, retentionDays = null) {
  let total = 0;
  const cutoffIso =
    retentionDays != null
      ? (() => {
          const cutoff = new Date();
          cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
          return cutoff.toISOString().slice(0, 19).replace("T", " ");
        })()
      : null;

  while (true) {
    let q = knex("game_play_history as h")
      .join("games as g", "g.id", "h.game_id")
      .whereIn("g.status", ["FINISHED", "CANCELLED"])
      .select("h.id")
      .limit(BATCH);

    if (cutoffIso) q = q.where("g.updated_at", "<", cutoffIso);

    const ids = (await q).map((r) => r.id);
    if (!ids.length) break;
    await knex("game_play_history").whereIn("id", ids).del();
    total += ids.length;
  }
  return total;
}

async function pruneOldestFinishedHistory(knex, maxBatches = 40) {
  let total = 0;
  for (let b = 0; b < maxBatches; b++) {
    if ((await historyCount(knex)) < ROW_CAP_THRESHOLD) break;
    const ids = (
      await knex("game_play_history as h")
        .join("games as g", "g.id", "h.game_id")
        .whereIn("g.status", ["FINISHED", "CANCELLED"])
        .orderBy("h.created_at", "asc")
        .select("h.id")
        .limit(BATCH)
    ).map((r) => r.id);
    if (!ids.length) break;
    await knex("game_play_history").whereIn("id", ids).del();
    total += ids.length;
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
    return;
  } catch (e) {
    console.warn(`[migration] MAX_ROWS alter on ${table}: ${e.message}`);
  }
  try {
    await knex.raw("ALTER TABLE ?? ENGINE=InnoDB ROW_FORMAT=DYNAMIC MAX_ROWS=0", [table]);
  } catch (e) {
    console.warn(`[migration] InnoDB alter on ${table}: ${e.message}`);
    throw e;
  }
}

export async function up(knex) {
  const client = knex.client.config.client;
  if (client !== "mysql" && client !== "mysql2") return;
  if (!(await knex.schema.hasTable("game_play_history"))) return;

  const before = await historyCount(knex);
  console.log(`[migration] game_play_history rows before prune: ${before}`);

  let pruned = await pruneTerminalGameHistory(knex, 30);
  console.log(`[migration] pruned ${pruned} history rows (finished/cancelled >30d)`);

  if ((await historyCount(knex)) >= ROW_CAP_THRESHOLD) {
    pruned = await pruneTerminalGameHistory(knex, null);
    console.log(`[migration] pruned ${pruned} history rows (all finished/cancelled)`);
  }

  if ((await historyCount(knex)) >= ROW_CAP_THRESHOLD) {
    pruned = await pruneOldestFinishedHistory(knex);
    console.log(`[migration] pruned ${pruned} oldest finished-game history rows`);
  }

  await tryOptimize(knex, "game_play_history");
  console.log(`[migration] game_play_history rows after prune: ${await historyCount(knex)}`);

  await tryAlterTable(knex, "game_play_history");
}

export async function down() {
  // No safe rollback — previous engine/limits are unknown.
}
