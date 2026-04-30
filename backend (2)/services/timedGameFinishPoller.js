import logger from "../config/logger.js";
import db from "../config/database.js";
import { tryFinishTimedGameById } from "../controllers/gameController.js";

const FINISHABLE = ["RUNNING", "IN_PROGRESS"];

/**
 * Periodically finishes timed games whose end time has passed (same logic as POST finish-by-time).
 * Clients should refetch or listen for game-update; they no longer need to call finish-by-time when the countdown hits zero.
 *
 * Set TIMED_GAME_FINISH_POLL_MS=0 to disable.
 */
export function startTimedGameFinishPoller(io) {
  const ms = Number(process.env.TIMED_GAME_FINISH_POLL_MS ?? "20000");
  if (!Number.isFinite(ms) || ms <= 0) {
    logger.info("Timed game finish poller disabled (TIMED_GAME_FINISH_POLL_MS unset or 0)");
    return () => {};
  }

  let timer = null;

  const tick = async () => {
    try {
      const rows = await db("games")
        .whereIn("status", FINISHABLE)
        .whereNotNull("duration")
        .select("id", "duration", "started_at", "created_at");

      const now = Date.now();
      for (const row of rows) {
        const dm = Number(row.duration) || 0;
        if (dm <= 0) continue;
        const startAt = row.started_at || row.created_at;
        const endMs = new Date(startAt).getTime() + dm * 60 * 1000;
        if (now < endMs - 30000) continue;

        const r = await tryFinishTimedGameById(row.id, io);
        if (r.outcome === "finished") {
          logger.info({ gameId: row.id }, "Timed game finished by backend poller");
        }
      }
    } catch (err) {
      logger.warn({ err: err?.message }, "Timed game finish poller tick failed");
    }
  };

  timer = setInterval(tick, ms);
  void tick();

  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}
