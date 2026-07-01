import logger from "../config/logger.js";
import db from "../config/database.js";
import {
  isDailySnapshotEnabled,
  refreshAllSnapshots,
  utcDateString,
} from "./leaderboardSnapshotService.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function msUntilNextUtcMidnight() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return Math.max(1000, next.getTime() - now.getTime());
}

async function ensureTodaySnapshotsIfMissing() {
  const today = utcDateString();
  const row = await db("leaderboard_snapshots").where({ snapshot_date: today }).first();
  if (!row) {
    logger.info({ today }, "No leaderboard snapshots for today — running refresh");
    await refreshAllSnapshots();
  }
}

/**
 * Rebuild all leaderboard snapshots every day at 00:00 UTC.
 * Set LEADERBOARD_DAILY_SNAPSHOT=false to disable.
 */
export function startLeaderboardSnapshotScheduler() {
  if (!isDailySnapshotEnabled()) {
    logger.info("Leaderboard daily snapshot scheduler disabled (LEADERBOARD_DAILY_SNAPSHOT=false)");
    return () => {};
  }

  let midnightTimeout = null;
  let dailyInterval = null;

  const runRefresh = async () => {
    try {
      await refreshAllSnapshots();
    } catch (err) {
      logger.error({ err: err?.message }, "Leaderboard daily snapshot refresh failed");
    }
  };

  void ensureTodaySnapshotsIfMissing();

  midnightTimeout = setTimeout(() => {
    void runRefresh();
    dailyInterval = setInterval(() => void runRefresh(), DAY_MS);
  }, msUntilNextUtcMidnight());

  logger.info(
    { nextRefreshMs: msUntilNextUtcMidnight() },
    "Leaderboard daily snapshot scheduler started (00:00 UTC)"
  );

  return () => {
    if (midnightTimeout) clearTimeout(midnightTimeout);
    if (dailyInterval) clearInterval(dailyInterval);
    midnightTimeout = null;
    dailyInterval = null;
  };
}
