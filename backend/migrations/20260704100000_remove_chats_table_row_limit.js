/**
 * Railway/MySQL: chats can hit "The table 'chats' is full" at ~2000 rows (MAX_ROWS on MyISAM).
 * Must DELETE rows before ALTER — altering a full table also fails with "table is full".
 */

const BATCH = 500;

async function chatCount(knex) {
  const row = await knex("chats").count("* as c").first();
  return Number(row?.c ?? 0);
}

async function pruneTerminalGameChats(knex, retentionDays = null) {
  let q = knex("chats as c")
    .join("games as g", "g.id", "c.game_id")
    .whereIn("g.status", ["FINISHED", "CANCELLED"])
    .whereNotNull("c.game_id")
    .select("c.id");

  if (retentionDays != null) {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
    const cutoffIso = cutoff.toISOString().slice(0, 19).replace("T", " ");
    q = q.where("g.updated_at", "<", cutoffIso);
  }

  const ids = (await q).map((r) => r.id);
  if (!ids.length) return 0;

  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    await knex("messages").whereIn("chat_id", slice).del();
    await knex("chats").whereIn("id", slice).del();
  }
  return ids.length;
}

async function pruneStalePendingChats(knex, staleDays = 14) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - staleDays);
  const cutoffIso = cutoff.toISOString().slice(0, 19).replace("T", " ");

  const ids = (
    await knex("chats as c")
      .join("games as g", "g.id", "c.game_id")
      .whereIn("g.status", ["PENDING", "WAITING", "CANCELLED"])
      .where("g.created_at", "<", cutoffIso)
      .whereNotNull("c.game_id")
      .select("c.id")
  ).map((r) => r.id);

  if (!ids.length) return 0;

  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    await knex("messages").whereIn("chat_id", slice).del();
    await knex("chats").whereIn("id", slice).del();
  }
  return ids.length;
}

async function tryOptimize(knex, table) {
  try {
    await knex.raw("OPTIMIZE TABLE ??", [table]);
  } catch (_) {
    // best-effort
  }
}

async function tryAlterTable(knex, table) {
  // Lightest fix first (MyISAM row cap) — needs less temp space than ENGINE change.
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
  if (!(await knex.schema.hasTable("chats"))) return;

  const before = await chatCount(knex);
  console.log(`[migration] chats rows before prune: ${before}`);

  let pruned = await pruneTerminalGameChats(knex, 30);
  console.log(`[migration] pruned ${pruned} chats (finished/cancelled >30d)`);

  if ((await chatCount(knex)) >= 1900) {
    pruned = await pruneTerminalGameChats(knex, null);
    console.log(`[migration] pruned ${pruned} chats (all finished/cancelled)`);
  }

  if ((await chatCount(knex)) >= 1900) {
    pruned = await pruneStalePendingChats(knex, 14);
    console.log(`[migration] pruned ${pruned} stale pending/waiting chats (>14d)`);
  }

  await tryOptimize(knex, "messages");
  await tryOptimize(knex, "chats");

  console.log(`[migration] chats rows after prune: ${await chatCount(knex)}`);

  if (await knex.schema.hasTable("messages")) {
    await tryAlterTable(knex, "messages");
  }
  await tryAlterTable(knex, "chats");
}

export async function down(knex) {
  // No safe rollback — previous engine/limits are unknown.
}
