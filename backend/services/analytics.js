/**
 * Analytics service for dashboard and user feedback.
 * - Aggregates from existing tables (games, game_play_history).
 * - Optional analytics_events for custom events (game_created, game_started, etc.).
 */

import db from "../config/database.js";

/**
 * Record a single event (best-effort; does not throw).
 * @param {string} eventType - e.g. game_created, game_started, game_finished, error
 * @param {object} options - { entityType, entityId, payload }
 */
// Memoize the schema check so every event write doesn't pay an information_schema query.
let eventsTableKnown = false;

export async function recordEvent(eventType, options = {}) {
  const { entityType = null, entityId = null, payload = null } = options;
  try {
    if (!eventsTableKnown) {
      const hasTable = await db.schema.hasTable("analytics_events");
      if (!hasTable) return;
      eventsTableKnown = true;
    }
    await db("analytics_events").insert({
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      payload: payload ? JSON.stringify(payload) : null,
    });
  } catch (_) {
    // Best-effort: do not break request if analytics fails
  }
}

/**
 * Get dashboard stats from existing tables + analytics_events if present.
 * @param {object} options - { startDate?, endDate? } optional date range (ISO date strings); defaults to last 7 days for gamesOverTime.
 */
export async function getDashboard(options = {}) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  let rangeStart = options.startDate ? new Date(options.startDate) : startOfWeek;
  let rangeEnd = options.endDate ? new Date(options.endDate) : now;
  if (rangeEnd < rangeStart) [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
  const dayCount = Math.ceil((rangeEnd - rangeStart) / (24 * 60 * 60 * 1000)) + 1;
  if (dayCount > 31) rangeStart = new Date(rangeEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalGames,
    gamesByStatus,
    gamesCreatedToday,
    gamesFinishedToday,
    gamesCreatedThisWeek,
    recentEvents,
    startedByDay,
    finishedByDay,
  ] = await Promise.all([
    db("games").count("* as count").first(),
    db("games").select("status").count("* as count").groupBy("status"),
    db("games").where("created_at", ">=", startOfToday).count("* as count").first(),
    db("games")
      .where("status", "FINISHED")
      .where("updated_at", ">=", startOfToday)
      .count("* as count")
      .first(),
    db("games").where("created_at", ">=", startOfWeek).count("* as count").first(),
    db.schema.hasTable("analytics_events").then((has) =>
      has
        ? db("analytics_events")
            .select("event_type")
            .count("* as count")
            .groupBy("event_type")
        : []
    ),
    // Games started per day (created_at) in range
    db("games")
      .select(db.raw("DATE(created_at) as day"))
      .where("created_at", ">=", rangeStart)
      .where("created_at", "<=", rangeEnd)
      .groupByRaw("DATE(created_at)")
      .count("* as count"),
    // Games finished per day (updated_at when status = FINISHED) in range
    db("games")
      .select(db.raw("DATE(updated_at) as day"))
      .where("status", "FINISHED")
      .where("updated_at", ">=", rangeStart)
      .where("updated_at", "<=", rangeEnd)
      .groupByRaw("DATE(updated_at)")
      .count("* as count"),
  ]);

  const statusCounts = Object.fromEntries(
    gamesByStatus.map((r) => [r.status, Number(r.count)])
  );

  const eventCounts = Array.isArray(recentEvents)
    ? Object.fromEntries(recentEvents.map((r) => [r.event_type, Number(r.count)]))
    : {};

  // Build last 7 days series: each day has started + finished counts
  const days = [];
  const startedMap = Object.fromEntries(
    (startedByDay || []).map((r) => [String(r.day).slice(0, 10), Number(r.count)])
  );
  const finishedMap = Object.fromEntries(
    (finishedByDay || []).map((r) => [String(r.day).slice(0, 10), Number(r.count)])
  );
  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    days.push({
      date: dateStr,
      started: startedMap[dateStr] ?? 0,
      finished: finishedMap[dateStr] ?? 0,
    });
  }

  return {
    games: {
      total: Number(totalGames?.count ?? 0),
      byStatus: statusCounts,
      createdToday: Number(gamesCreatedToday?.count ?? 0),
      finishedToday: Number(gamesFinishedToday?.count ?? 0),
      createdThisWeek: Number(gamesCreatedThisWeek?.count ?? 0),
    },
    gamesOverTime: days,
    events: eventCounts,
    generatedAt: now.toISOString(),
  };
}

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Distinct active users per period (daily / weekly / monthly).
 * A user counts as active if they played (game_play_history) or had a profile update that day.
 * @param {'daily'|'weekly'|'monthly'} period
 */
export async function getActiveUsersSeries(period = "daily") {
  const now = new Date();
  const today = startOfUtcDay(now);
  let rangeStart = new Date(today);

  if (period === "weekly") {
    rangeStart.setUTCDate(rangeStart.getUTCDate() - 12 * 7);
  } else if (period === "monthly") {
    rangeStart.setUTCMonth(rangeStart.getUTCMonth() - 12);
  } else {
    rangeStart.setUTCDate(rangeStart.getUTCDate() - 30);
  }

  const rangeStartIso = rangeStart.toISOString().slice(0, 19).replace("T", " ");

  let groupExpr;
  let periodLabelExpr;
  if (period === "weekly") {
    groupExpr = "DATE_FORMAT(activity_date, '%x-W%v')";
    periodLabelExpr = "DATE_FORMAT(MIN(activity_date), '%Y-%m-%d')";
  } else if (period === "monthly") {
    groupExpr = "DATE_FORMAT(activity_date, '%Y-%m')";
    periodLabelExpr = "DATE_FORMAT(MIN(activity_date), '%Y-%m-01')";
  } else {
    groupExpr = "activity_date";
    periodLabelExpr = "activity_date";
  }

  const rows = await db.raw(
    `
    SELECT
      ${groupExpr} AS period_key,
      ${periodLabelExpr} AS period_start,
      COUNT(DISTINCT user_id) AS active_users
    FROM (
      SELECT DATE(updated_at) AS activity_date, id AS user_id
      FROM users
      WHERE updated_at >= ?
      UNION
      SELECT DATE(gph.created_at) AS activity_date, gp.user_id
      FROM game_play_history gph
      INNER JOIN game_players gp ON gp.id = gph.game_player_id
      WHERE gph.created_at >= ?
    ) activity
    GROUP BY period_key
    ORDER BY period_start ASC
    `,
    [rangeStartIso, rangeStartIso]
  );

  const series = (rows[0] || []).map((r) => ({
    period: String(r.period_key),
    periodStart: r.period_start ? String(r.period_start).slice(0, 10) : String(r.period_key),
    activeUsers: Number(r.active_users ?? 0),
  }));

  const weekStart = new Date(today);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const weekStartIso = weekStart.toISOString().slice(0, 19).replace("T", " ");
  const monthStartIso = monthStart.toISOString().slice(0, 19).replace("T", " ");
  const todayIso = today.toISOString().slice(0, 19).replace("T", " ");

  const [[todayRow], [weekRow], [monthRow]] = await Promise.all([
    db.raw(
      `SELECT COUNT(DISTINCT user_id) AS c FROM (
        SELECT id AS user_id FROM users WHERE updated_at >= ?
        UNION
        SELECT gp.user_id FROM game_play_history gph
        INNER JOIN game_players gp ON gp.id = gph.game_player_id
        WHERE gph.created_at >= ?
      ) t`,
      [todayIso, todayIso]
    ),
    db.raw(
      `SELECT COUNT(DISTINCT user_id) AS c FROM (
        SELECT id AS user_id FROM users WHERE updated_at >= ?
        UNION
        SELECT gp.user_id FROM game_play_history gph
        INNER JOIN game_players gp ON gp.id = gph.game_player_id
        WHERE gph.created_at >= ?
      ) t`,
      [weekStartIso, weekStartIso]
    ),
    db.raw(
      `SELECT COUNT(DISTINCT user_id) AS c FROM (
        SELECT id AS user_id FROM users WHERE updated_at >= ?
        UNION
        SELECT gp.user_id FROM game_play_history gph
        INNER JOIN game_players gp ON gp.id = gph.game_player_id
        WHERE gph.created_at >= ?
      ) t`,
      [monthStartIso, monthStartIso]
    ),
  ]);

  return {
    period,
    series,
    summary: {
      dauToday: Number(todayRow?.[0]?.c ?? 0),
      wauLast7Days: Number(weekRow?.[0]?.c ?? 0),
      mauThisMonth: Number(monthRow?.[0]?.c ?? 0),
    },
    generatedAt: now.toISOString(),
  };
}

function pct(numerator, denominator) {
  const d = Number(denominator);
  if (!d || d <= 0) return null;
  return Math.round((Number(numerator) / d) * 1000) / 10;
}

/**
 * Cohort retention from game_play_history (first play day per user via game_players.user_id).
 * Dn = user played again on exactly cohort_date + n days (UTC calendar days).
 *
 * @param {{ startDate?: string, endDate?: string, days?: number }} options
 */
export async function getRetentionCohorts(options = {}) {
  const now = new Date();
  const today = startOfUtcDay(now);

  let rangeEnd = options.endDate ? startOfUtcDay(new Date(options.endDate)) : new Date(today);
  let rangeStart = options.startDate
    ? startOfUtcDay(new Date(options.startDate))
    : new Date(today.getTime() - (Math.max(1, Number(options.days) || 30) - 1) * 24 * 60 * 60 * 1000);

  if (rangeEnd < rangeStart) [rangeStart, rangeEnd] = [rangeEnd, rangeStart];

  const rangeStartIso = rangeStart.toISOString().slice(0, 10);
  const rangeEndIso = rangeEnd.toISOString().slice(0, 10);

  const matureD1Cutoff = new Date(today);
  matureD1Cutoff.setUTCDate(matureD1Cutoff.getUTCDate() - 1);
  const matureD3Cutoff = new Date(today);
  matureD3Cutoff.setUTCDate(matureD3Cutoff.getUTCDate() - 3);
  const matureD7Cutoff = new Date(today);
  matureD7Cutoff.setUTCDate(matureD7Cutoff.getUTCDate() - 7);

  const rows = await db.raw(
    `
    WITH user_first_seen AS (
      SELECT gp.user_id, DATE(MIN(gph.created_at)) AS cohort_date
      FROM game_play_history gph
      INNER JOIN game_players gp ON gp.id = gph.game_player_id
      WHERE gp.user_id IS NOT NULL
      GROUP BY gp.user_id
    ),
    user_activity_days AS (
      SELECT DISTINCT gp.user_id, DATE(gph.created_at) AS activity_date
      FROM game_play_history gph
      INNER JOIN game_players gp ON gp.id = gph.game_player_id
      WHERE gp.user_id IS NOT NULL
    )
    SELECT
      ufs.cohort_date,
      COUNT(DISTINCT ufs.user_id) AS cohort_size,
      COUNT(DISTINCT CASE
        WHEN uad.activity_date = DATE_ADD(ufs.cohort_date, INTERVAL 1 DAY) THEN ufs.user_id
      END) AS d1_retained,
      COUNT(DISTINCT CASE
        WHEN uad.activity_date = DATE_ADD(ufs.cohort_date, INTERVAL 3 DAY) THEN ufs.user_id
      END) AS d3_retained,
      COUNT(DISTINCT CASE
        WHEN uad.activity_date = DATE_ADD(ufs.cohort_date, INTERVAL 7 DAY) THEN ufs.user_id
      END) AS d7_retained
    FROM user_first_seen ufs
    LEFT JOIN user_activity_days uad ON uad.user_id = ufs.user_id
    WHERE ufs.cohort_date >= ? AND ufs.cohort_date <= ?
    GROUP BY ufs.cohort_date
    ORDER BY ufs.cohort_date DESC
    `,
    [rangeStartIso, rangeEndIso]
  );

  const cohorts = (rows[0] || []).map((r) => {
    const cohortDate = r.cohort_date ? String(r.cohort_date).slice(0, 10) : "";
    const cohortDateObj = cohortDate ? startOfUtcDay(new Date(`${cohortDate}T00:00:00.000Z`)) : null;
    const cohortSize = Number(r.cohort_size ?? 0);
    const d1Retained = Number(r.d1_retained ?? 0);
    const d3Retained = Number(r.d3_retained ?? 0);
    const d7Retained = Number(r.d7_retained ?? 0);

    const matureD1 = cohortDateObj != null && cohortDateObj <= matureD1Cutoff;
    const matureD3 = cohortDateObj != null && cohortDateObj <= matureD3Cutoff;
    const matureD7 = cohortDateObj != null && cohortDateObj <= matureD7Cutoff;

    return {
      cohortDate,
      cohortSize,
      d1Retained,
      d3Retained,
      d7Retained,
      d1Rate: matureD1 ? pct(d1Retained, cohortSize) : null,
      d3Rate: matureD3 ? pct(d3Retained, cohortSize) : null,
      d7Rate: matureD7 ? pct(d7Retained, cohortSize) : null,
      matureD1,
      matureD3,
      matureD7,
    };
  });

  function weightedAvgRate(matureKey, retainedKey) {
    let retained = 0;
    let size = 0;
    for (const c of cohorts) {
      if (!c[matureKey]) continue;
      retained += c[retainedKey];
      size += c.cohortSize;
    }
    return pct(retained, size);
  }

  const summary = {
    avgD1Rate: weightedAvgRate("matureD1", "d1Retained"),
    avgD3Rate: weightedAvgRate("matureD3", "d3Retained"),
    avgD7Rate: weightedAvgRate("matureD7", "d7Retained"),
    matureCohortCount: {
      d1: cohorts.filter((c) => c.matureD1).length,
      d3: cohorts.filter((c) => c.matureD3).length,
      d7: cohorts.filter((c) => c.matureD7).length,
    },
  };

  return {
    range: { start: rangeStartIso, end: rangeEndIso },
    cohorts,
    summary,
    source: "game_play_history",
    definition:
      "First-seen = earliest game_play_history row per user (via game_players). Dn = distinct user played on cohort_date + n UTC days.",
    generatedAt: now.toISOString(),
  };
}

/**
 * Get recent analytics events for "recent activity" / errors tab.
 * @param {number} limit - Max rows (default 50, max 200).
 */
export async function getRecentActivity(limit = 50) {
  const hasTable = await db.schema.hasTable("analytics_events");
  if (!hasTable) return { events: [], errors: [] };
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const rows = await db("analytics_events")
    .select("id", "event_type", "entity_type", "entity_id", "payload", "created_at")
    .orderBy("created_at", "desc")
    .limit(capped);
  const events = rows.map((r) => ({
    id: r.id,
    event_type: r.event_type,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    payload: typeof r.payload === "string" ? (() => { try { return JSON.parse(r.payload); } catch { return null; } })() : r.payload,
    created_at: r.created_at,
  }));
  const errors = events.filter((e) => e.event_type === "error");
  return { events, errors };
}
