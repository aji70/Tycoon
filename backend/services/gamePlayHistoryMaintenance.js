/**
 * Prune game_play_history for finished/cancelled games in small committed batches.
 * Used by migrations, startup hook, admin API, and scripts.
 */
import db from "../config/database.js";
import logger from "../config/logger.js";

const DELETE_BATCH = 100;

export async function countGamePlayHistory() {
  const row = await db("game_play_history").count("* as c").first();
  return Number(row?.c ?? 0);
}

/**
 * @param {{ retentionDays?: number|null, batchSize?: number }} options
 * @returns {number} rows deleted this batch (0 = nothing left matching)
 */
export async function deleteFinishedHistoryBatch({
  retentionDays = null,
  batchSize = DELETE_BATCH,
} = {}) {
  // MySQL rejects LIMIT on multi-table DELETE … JOIN — select ids, then delete.
  let q = db("game_play_history as h")
    .join("games as g", "g.id", "h.game_id")
    .whereIn("g.status", ["FINISHED", "CANCELLED"])
    .select("h.id")
    .limit(batchSize);

  if (retentionDays != null) {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
    const cutoffIso = cutoff.toISOString().slice(0, 19).replace("T", " ");
    q = q.where("g.updated_at", "<", cutoffIso);
  }

  const ids = (await q).map((r) => r.id);
  if (!ids.length) return 0;
  return await db("game_play_history").whereIn("id", ids).del();
}

async function prunePhase(retentionDays, maxRows, onProgress) {
  let deleted = 0;
  let batches = 0;
  while (deleted < maxRows) {
    const n = await deleteFinishedHistoryBatch({ retentionDays });
    if (n === 0) break;
    deleted += n;
    batches += 1;
    if (onProgress && batches % 50 === 0) onProgress(deleted);
  }
  return deleted;
}

/**
 * @param {{ aggressive?: boolean, maxRowsPerPhase?: number, retentionDaysFirst?: number, dryRun?: boolean }} options
 */
export async function runGamePlayHistoryMaintenance(options = {}) {
  const aggressive = Boolean(options.aggressive);
  const retentionDaysFirst = Math.max(1, Number(options.retentionDaysFirst) || 30);
  const maxRowsPerPhase =
    Number(options.maxRowsPerPhase) ||
    Number(process.env.PRUNE_HISTORY_MAX_ROWS) ||
    2_000_000;
  const dryRun = Boolean(options.dryRun);

  const before = await countGamePlayHistory();

  if (dryRun) {
    const oldRow = await db("game_play_history as h")
      .join("games as g", "g.id", "h.game_id")
      .whereIn("g.status", ["FINISHED", "CANCELLED"])
      .where("g.updated_at", "<", (() => {
        const c = new Date();
        c.setUTCDate(c.getUTCDate() - retentionDaysFirst);
        return c.toISOString().slice(0, 19).replace("T", " ");
      })())
      .count("* as c")
      .first();
    const finishedRow = await db("game_play_history as h")
      .join("games as g", "g.id", "h.game_id")
      .whereIn("g.status", ["FINISHED", "CANCELLED"])
      .count("* as c")
      .first();
    return {
      dryRun: true,
      before,
      prunableOlderThanRetention: Number(oldRow?.c ?? 0),
      prunableAllFinished: Number(finishedRow?.c ?? 0),
    };
  }

  let deleted = 0;
  const logProgress = (n) =>
    logger.info({ deletedSoFar: n, totalBefore: before }, "pruning game_play_history…");

  deleted += await prunePhase(retentionDaysFirst, maxRowsPerPhase, logProgress);

  const mid = await countGamePlayHistory();
  if (aggressive || mid > 80_000) {
    deleted += await prunePhase(null, maxRowsPerPhase, logProgress);
  }

  try {
    await db.raw("OPTIMIZE TABLE game_play_history");
  } catch (_) {
    /* best-effort */
  }

  const after = await countGamePlayHistory();
  logger.info({ before, after, deleted }, "game_play_history maintenance done");
  return { before, after, deleted };
}

/** Run on server boot when the table is large (frees disk so rolls work). */
export async function maybeRunGamePlayHistoryMaintenanceOnStartup() {
  if (process.env.SKIP_HISTORY_PRUNE_ON_STARTUP === "true") return null;
  try {
    const count = await countGamePlayHistory();
    const threshold = Number(process.env.HISTORY_PRUNE_STARTUP_THRESHOLD) || 80_000;
    if (count < threshold) return null;
    logger.info({ count, threshold }, "game_play_history over threshold — pruning on startup");
    return runGamePlayHistoryMaintenance({ aggressive: true });
  } catch (err) {
    logger.error({ err }, "startup game_play_history maintenance failed");
    return null;
  }
}
