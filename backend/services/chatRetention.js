import db from "../config/database.js";
import logger from "../config/logger.js";

const BATCH = 500;

/**
 * Remove chat rows (and their messages) for old finished/cancelled games.
 * Keeps the lobby chat row (game_id IS NULL).
 *
 * @param {{ retentionDays?: number, dryRun?: boolean }} options
 */
export async function pruneOldGameChats(options = {}) {
  const retentionDays = Math.max(1, Number(options.retentionDays) || 30);
  const dryRun = Boolean(options.dryRun);

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  const cutoffIso = cutoff.toISOString().slice(0, 19).replace("T", " ");

  const chatIdRows = await db("chats as c")
    .join("games as g", "g.id", "c.game_id")
    .whereIn("g.status", ["FINISHED", "CANCELLED"])
    .where("g.updated_at", "<", cutoffIso)
    .whereNotNull("c.game_id")
    .select("c.id");

  const chatIds = chatIdRows.map((r) => r.id);
  if (!chatIds.length) {
    return { retentionDays, dryRun, chatCount: 0, messageCount: 0, cutoff: cutoffIso };
  }

  let messageCount = 0;
  if (dryRun) {
    const msgRow = await db("messages").whereIn("chat_id", chatIds).count("* as c").first();
    messageCount = Number(msgRow?.c ?? 0);
    return {
      retentionDays,
      dryRun: true,
      chatCount: chatIds.length,
      messageCount,
      cutoff: cutoffIso,
    };
  }

  for (let i = 0; i < chatIds.length; i += BATCH) {
    const slice = chatIds.slice(i, i + BATCH);
    const deletedMsgs = await db("messages").whereIn("chat_id", slice).del();
    messageCount += deletedMsgs;
    await db("chats").whereIn("id", slice).del();
  }

  logger.info(
    { retentionDays, chatCount: chatIds.length, messageCount, cutoff: cutoffIso },
    "pruned old game chats"
  );

  return {
    retentionDays,
    dryRun: false,
    chatCount: chatIds.length,
    messageCount,
    cutoff: cutoffIso,
  };
}

/**
 * Remove play-history rows for old finished/cancelled games (frees MyISAM row cap).
 *
 * @param {{ retentionDays?: number, dryRun?: boolean }} options
 */
export async function pruneOldGamePlayHistory(options = {}) {
  const retentionDays = Math.max(1, Number(options.retentionDays) || 30);
  const dryRun = Boolean(options.dryRun);

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  const cutoffIso = cutoff.toISOString().slice(0, 19).replace("T", " ");

  const idRows = await db("game_play_history as h")
    .join("games as g", "g.id", "h.game_id")
    .whereIn("g.status", ["FINISHED", "CANCELLED"])
    .where("g.updated_at", "<", cutoffIso)
    .select("h.id");

  const ids = idRows.map((r) => r.id);
  if (!ids.length) {
    return { retentionDays, dryRun, historyCount: 0, cutoff: cutoffIso };
  }

  if (dryRun) {
    return {
      retentionDays,
      dryRun: true,
      historyCount: ids.length,
      cutoff: cutoffIso,
    };
  }

  let deleted = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    deleted += await db("game_play_history").whereIn("id", slice).del();
  }

  logger.info(
    { retentionDays, historyCount: deleted, cutoff: cutoffIso },
    "pruned old game play history"
  );

  return {
    retentionDays,
    dryRun: false,
    historyCount: deleted,
    cutoff: cutoffIso,
  };
}

/** Map MySQL "table is full" to an actionable message for clients. */
export function formatDbErrorForClient(error) {
  const msg = String(error?.message || "Database error");
  if (error?.code === "ER_RECORD_FILE_FULL" || /table '.*' is full/i.test(msg)) {
    const table = msg.match(/table '([^']+)' is full/i)?.[1] ?? "database";
    if (table === "game_play_history") {
      return "Game move log is full — rolls cannot be saved. An admin must run database maintenance (prune old game history).";
    }
    return `Database storage is full (${table}). Free disk space or prune old game data before continuing.`;
  }
  return msg;
}
