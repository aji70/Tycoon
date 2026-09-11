/**
 * Analytics service for dashboard and user feedback.
 * - Aggregates from existing tables (games, game_play_history).
 * - Optional analytics_events for custom events (game_created, game_started, etc.).
 */

import db from "../config/database.js";
import logger from "../config/logger.js";

/** Snapshot the user confirmed on 11 Sep 2026. New shop/tip inflows after this instant add on top. */
const ONCHAIN_REVENUE_BASELINE_USD = Number(process.env.MINIPAY_ONCHAIN_REVENUE_BASELINE_USD || 106);
const ONCHAIN_REVENUE_BASELINE_AT =
  process.env.MINIPAY_ONCHAIN_REVENUE_BASELINE_AT || "2026-09-11T21:40:00.000Z";

async function sumStableInflowsAfter(sinceIso) {
  let incrementalUsd = 0;
  const { formatUnits } = await import("ethers");

  if (await db.schema.hasTable("soft_perk_purchases")) {
    const q = db("soft_perk_purchases").select("amount", "payment_token", "entitlement");
    if (await db.schema.hasColumn("soft_perk_purchases", "created_at")) {
      q.where("created_at", ">", sinceIso);
    }
    const rows = await q;
    for (const row of rows || []) {
      if (row.entitlement === "ai_tip_pack") continue;
      const token = Number(row.payment_token);
      if (token === 0 || Number.isNaN(token)) continue;
      try {
        const n = Number(formatUnits(BigInt(String(row.amount || "0")), 6));
        if (Number.isFinite(n)) incrementalUsd += n;
      } catch {
        /* ignore */
      }
    }
  }

  if (await db.schema.hasTable("game_ai_tip_pack_purchases")) {
    const q = db("game_ai_tip_pack_purchases").select("amount_usdc");
    if (await db.schema.hasColumn("game_ai_tip_pack_purchases", "created_at")) {
      q.where("created_at", ">", sinceIso);
    }
    const rows = await q;
    for (const row of rows || []) {
      const n = Number(row.amount_usdc);
      if (Number.isFinite(n)) incrementalUsd += n;
    }
  }

  return Math.round(incrementalUsd * 100) / 100;
}

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

/** mysql2 returns SQL DATE as a JS Date; String(date).slice(0,10) is locale-dependent garbage. */
function toIsoDateString(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

function addUtcDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Dn rate is mature once cohort_date + n UTC calendar days has fully ended (strictly before today). */
function isRetentionDayMature(cohortDateObj, n, today) {
  return cohortDateObj != null && addUtcDays(cohortDateObj, n) < today;
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

/**
 * New user signups per period (daily / weekly / monthly) from users.created_at.
 * @param {'daily'|'weekly'|'monthly'} period
 */
export async function getNewUsersSeries(period = "daily") {
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
    groupExpr = "DATE_FORMAT(signup_date, '%x-W%v')";
    periodLabelExpr = "DATE_FORMAT(MIN(signup_date), '%Y-%m-%d')";
  } else if (period === "monthly") {
    groupExpr = "DATE_FORMAT(signup_date, '%Y-%m')";
    periodLabelExpr = "DATE_FORMAT(MIN(signup_date), '%Y-%m-01')";
  } else {
    groupExpr = "signup_date";
    periodLabelExpr = "signup_date";
  }

  const rows = await db.raw(
    `
    SELECT
      ${groupExpr} AS period_key,
      ${periodLabelExpr} AS period_start,
      COUNT(*) AS new_users
    FROM (
      SELECT DATE(created_at) AS signup_date
      FROM users
      WHERE created_at >= ?
    ) signups
    GROUP BY period_key
    ORDER BY period_start ASC
    `,
    [rangeStartIso]
  );

  const series = (rows[0] || []).map((r) => ({
    period: String(r.period_key),
    periodStart: toIsoDateString(r.period_start) || String(r.period_key),
    newUsers: Number(r.new_users ?? 0),
  }));

  const weekStart = new Date(today);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const weekStartIso = weekStart.toISOString().slice(0, 19).replace("T", " ");
  const monthStartIso = monthStart.toISOString().slice(0, 19).replace("T", " ");
  const todayIso = today.toISOString().slice(0, 19).replace("T", " ");

  const [[todayRow], [weekRow], [monthRow]] = await Promise.all([
    db.raw(`SELECT COUNT(*) AS c FROM users WHERE created_at >= ?`, [todayIso]),
    db.raw(`SELECT COUNT(*) AS c FROM users WHERE created_at >= ?`, [weekStartIso]),
    db.raw(`SELECT COUNT(*) AS c FROM users WHERE created_at >= ?`, [monthStartIso]),
  ]);

  return {
    period,
    series,
    summary: {
      newToday: Number(todayRow?.[0]?.c ?? 0),
      newThisWeek: Number(weekRow?.[0]?.c ?? 0),
      newThisMonth: Number(monthRow?.[0]?.c ?? 0),
    },
    source: "users.created_at",
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
 * @param {{ startDate?: string, endDate?: string, days?: number, debug?: boolean }} options
 */
export async function getRetentionCohorts(options = {}) {
  const now = new Date();
  const today = startOfUtcDay(now);
  const debug = options.debug === true || process.env.RETENTION_DEBUG === "true";

  let rangeEnd = options.endDate ? startOfUtcDay(new Date(options.endDate)) : new Date(today);
  let rangeStart = options.startDate
    ? startOfUtcDay(new Date(options.startDate))
    : new Date(today.getTime() - (Math.max(1, Number(options.days) || 30) - 1) * 24 * 60 * 60 * 1000);

  if (rangeEnd < rangeStart) [rangeStart, rangeEnd] = [rangeEnd, rangeStart];

  const rangeStartIso = rangeStart.toISOString().slice(0, 10);
  const rangeEndIso = rangeEnd.toISOString().slice(0, 10);

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
    const cohortDate = toIsoDateString(r.cohort_date);
    const cohortDateObj = cohortDate ? startOfUtcDay(new Date(`${cohortDate}T00:00:00.000Z`)) : null;
    const cohortSize = Number(r.cohort_size ?? 0);
    const d1Retained = Number(r.d1_retained ?? 0);
    const d3Retained = Number(r.d3_retained ?? 0);
    const d7Retained = Number(r.d7_retained ?? 0);

    const matureD1 = isRetentionDayMature(cohortDateObj, 1, today);
    const matureD3 = isRetentionDayMature(cohortDateObj, 3, today);
    const matureD7 = isRetentionDayMature(cohortDateObj, 7, today);

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

  if (debug) {
    const probeCohort = "2026-07-03";
    const probeD1Day = "2026-07-04";
    try {
      const probeUsers = await db.raw(
        `
        WITH user_first_seen AS (
          SELECT gp.user_id, DATE(MIN(gph.created_at)) AS cohort_date
          FROM game_play_history gph
          INNER JOIN game_players gp ON gp.id = gph.game_player_id
          WHERE gp.user_id IS NOT NULL
          GROUP BY gp.user_id
        )
        SELECT user_id FROM user_first_seen WHERE cohort_date = ?
        `,
        [probeCohort]
      );
      const userIds = (probeUsers[0] || []).map((u) => u.user_id);
      let probeActivity = null;
      if (userIds.length) {
        const placeholders = userIds.map(() => "?").join(",");
        const act = await db.raw(
          `
          SELECT COUNT(*) AS history_rows, COUNT(DISTINCT gp.user_id) AS distinct_users
          FROM game_play_history gph
          INNER JOIN game_players gp ON gp.id = gph.game_player_id
          WHERE gp.user_id IN (${placeholders}) AND DATE(gph.created_at) = ?
          `,
          [...userIds, probeD1Day]
        );
        probeActivity = act[0]?.[0] ?? null;
      }
      const jul3 = cohorts.find((c) => c.cohortDate === probeCohort);
      logger.info(
        {
          today: today.toISOString(),
          probeCohort,
          probeD1Day,
          probeUserIds: userIds,
          probeActivity,
          jul3Cohort: jul3 ?? null,
        },
        "retention cohort debug"
      );
    } catch (err) {
      logger.warn({ err }, "retention cohort debug probe failed");
    }
  }

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

/**
 * MiniPay activity + agent registry + users / txs / lifetime revenue inflows.
 * Revenue is cumulative inflows (sale & purchase events), NOT current treasury
 * balance — withdrawals do not reduce these totals.
 * @param {object} options - { startDate?, endDate? }
 */
export async function getMinipayStats(options = {}) {
  const now = new Date();
  const startOfToday = startOfUtcDay(now);
  const startOfWeek = addUtcDays(startOfToday, -7);
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  let rangeStart = options.startDate ? new Date(options.startDate) : startOfWeek;
  let rangeEnd = options.endDate ? new Date(options.endDate) : now;
  if (Number.isNaN(rangeStart.getTime())) rangeStart = startOfWeek;
  if (Number.isNaN(rangeEnd.getTime())) rangeEnd = now;
  if (rangeEnd < rangeStart) [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
  const dayCount = Math.ceil((rangeEnd - rangeStart) / (24 * 60 * 60 * 1000)) + 1;
  if (dayCount > 62) rangeStart = new Date(rangeEnd.getTime() - 61 * 24 * 60 * 60 * 1000);

  const hasGamesTable = await db.schema.hasTable("games");
  const hasMinipayCol =
    hasGamesTable && (await db.schema.hasColumn("games", "is_minipay"));
  const hasAgents = await db.schema.hasTable("user_agents");
  const hasIsAi = hasGamesTable && (await db.schema.hasColumn("games", "is_ai"));
  const hasPlayers = await db.schema.hasTable("game_players");
  const hasSoftPerks = await db.schema.hasTable("soft_perk_purchases");
  const hasTipPacks = await db.schema.hasTable("game_ai_tip_pack_purchases");
  const hasContractGameId =
    hasGamesTable && (await db.schema.hasColumn("games", "contract_game_id"));

  const emptyGames = {
    total: 0,
    byStatus: {},
    createdToday: 0,
    finishedToday: 0,
    createdThisWeek: 0,
    createdThisMonth: 0,
    distinctCreators: 0,
    aiGames: 0,
    humanGames: 0,
  };

  let games = { ...emptyGames };
  let gamesOverTime = [];
  let note =
    "Counts use games.is_minipay. Historical rows may include some Celo main-app creates; new MiniPay-app creates are always tagged.";

  if (hasMinipayCol) {
    try {
      const mp = () => db("games").where("is_minipay", true);
      const [
        totalGames,
        gamesByStatus,
        createdToday,
        finishedToday,
        createdThisWeek,
        createdThisMonth,
        distinctCreators,
        aiSplit,
        startedByDay,
        finishedByDay,
      ] = await Promise.all([
        mp().count("* as count").first(),
        mp().select("status").count("* as count").groupBy("status"),
        mp().where("created_at", ">=", startOfToday).count("* as count").first(),
        mp().where("status", "FINISHED").where("updated_at", ">=", startOfToday).count("* as count").first(),
        mp().where("created_at", ">=", startOfWeek).count("* as count").first(),
        mp().where("created_at", ">=", startOfMonth).count("* as count").first(),
        mp().whereNotNull("creator_id").countDistinct("creator_id as count").first(),
        hasIsAi
          ? mp()
              .select(db.raw("SUM(CASE WHEN is_ai = 1 THEN 1 ELSE 0 END) as ai"))
              .select(db.raw("SUM(CASE WHEN is_ai = 0 OR is_ai IS NULL THEN 1 ELSE 0 END) as human"))
              .first()
          : Promise.resolve({ ai: 0, human: 0 }),
        mp()
          .select(db.raw("DATE(created_at) as day"))
          .where("created_at", ">=", rangeStart)
          .where("created_at", "<=", rangeEnd)
          .groupByRaw("DATE(created_at)")
          .count("* as count"),
        mp()
          .select(db.raw("DATE(updated_at) as day"))
          .where("status", "FINISHED")
          .where("updated_at", ">=", rangeStart)
          .where("updated_at", "<=", rangeEnd)
          .groupByRaw("DATE(updated_at)")
          .count("* as count"),
      ]);

      games = {
        total: Number(totalGames?.count ?? 0),
        byStatus: Object.fromEntries((gamesByStatus || []).map((r) => [r.status, Number(r.count)])),
        createdToday: Number(createdToday?.count ?? 0),
        finishedToday: Number(finishedToday?.count ?? 0),
        createdThisWeek: Number(createdThisWeek?.count ?? 0),
        createdThisMonth: Number(createdThisMonth?.count ?? 0),
        distinctCreators: Number(distinctCreators?.count ?? 0),
        aiGames: Number(aiSplit?.ai ?? 0),
        humanGames: Number(aiSplit?.human ?? 0),
      };

      const startedMap = Object.fromEntries(
        (startedByDay || []).map((r) => [toIsoDateString(r.day), Number(r.count)])
      );
      const finishedMap = Object.fromEntries(
        (finishedByDay || []).map((r) => [toIsoDateString(r.day), Number(r.count)])
      );
      for (let d = new Date(rangeStart); d <= rangeEnd; d = addUtcDays(d, 1)) {
        const dateStr = toIsoDateString(d);
        if (!dateStr) continue;
        gamesOverTime.push({
          date: dateStr,
          started: startedMap[dateStr] ?? 0,
          finished: finishedMap[dateStr] ?? 0,
        });
      }
    } catch (gameErr) {
      logger.warn({ err: gameErr, message: gameErr?.message }, "getMinipayStats games query failed");
      note = `MiniPay game stats query failed (${gameErr?.sqlMessage || gameErr?.message || "query error"}).`;
    }
  } else {
    note = "games.is_minipay column missing — MiniPay game stats unavailable until migration runs.";
  }

  let agents = {
    total: 0,
    byStatus: {},
    createdToday: 0,
    createdThisWeek: 0,
    createdThisMonth: 0,
    withErc8004: 0,
    publicCount: 0,
  };

  if (hasAgents) {
    try {
      const hasStatus = await db.schema.hasColumn("user_agents", "status");
      const hasErc = await db.schema.hasColumn("user_agents", "erc8004_agent_id");
      const hasPublic = await db.schema.hasColumn("user_agents", "is_public");
      const [
        totalAgents,
        byStatus,
        createdToday,
        createdThisWeek,
        createdThisMonth,
        withErc8004,
        publicCount,
      ] = await Promise.all([
        db("user_agents").count("* as count").first(),
        hasStatus
          ? db("user_agents").select("status").count("* as count").groupBy("status")
          : Promise.resolve([]),
        db("user_agents").where("created_at", ">=", startOfToday).count("* as count").first(),
        db("user_agents").where("created_at", ">=", startOfWeek).count("* as count").first(),
        db("user_agents").where("created_at", ">=", startOfMonth).count("* as count").first(),
        hasErc
          ? db("user_agents").whereNotNull("erc8004_agent_id").count("* as count").first()
          : Promise.resolve({ count: 0 }),
        hasPublic
          ? db("user_agents").where("is_public", true).count("* as count").first()
          : Promise.resolve({ count: 0 }),
      ]);

      agents = {
        total: Number(totalAgents?.count ?? 0),
        byStatus: Object.fromEntries(
          (byStatus || []).map((r) => [r.status || "unknown", Number(r.count)])
        ),
        createdToday: Number(createdToday?.count ?? 0),
        createdThisWeek: Number(createdThisWeek?.count ?? 0),
        createdThisMonth: Number(createdThisMonth?.count ?? 0),
        withErc8004: Number(withErc8004?.count ?? 0),
        publicCount: Number(publicCount?.count ?? 0),
      };
    } catch (agentErr) {
      logger.warn({ err: agentErr, message: agentErr?.message }, "getMinipayStats agents query failed");
      note = `${note} Agent counts unavailable (${agentErr?.message || "query error"}).`;
    }
  }

  /** Cutoff: treat human accounts registered on/after this date as MiniPay cohort. */
  const MINIPAY_USER_SINCE = "2026-06-27T00:00:00.000Z";

  /** @type {{
   *   registeredSinceCutoff: number,
   *   registeredSinceCutoffIncludingAi: number,
   *   cutoff: string,
   *   distinctHumanPlayers: number,
   *   distinctHumanCreators: number,
   *   taggedPlayersIncludingAi: number,
   *   distinctCreators: number,
   *   distinctPlayers: number
   * }} */
  const users = {
    registeredSinceCutoff: 0,
    registeredSinceCutoffIncludingAi: 0,
    cutoff: "2026-06-27",
    distinctHumanPlayers: 0,
    distinctHumanCreators: 0,
    taggedPlayersIncludingAi: 0,
    distinctCreators: games.distinctCreators || 0,
    distinctPlayers: 0,
  };

  /** @type {{
   *   gamesCreated: number,
   *   humanGames: number,
   *   aiGames: number,
   *   playerJoins: number,
   *   humanPlayerJoins: number,
   *   onChainGames: number,
   *   softPerkPurchases: number,
   *   tipPackPurchases: number,
   *   total: number
   * }} */
  const transactions = {
    gamesCreated: games.total || 0,
    humanGames: games.humanGames || 0,
    aiGames: games.aiGames || 0,
    playerJoins: 0,
    humanPlayerJoins: 0,
    onChainGames: 0,
    softPerkPurchases: 0,
    tipPackPurchases: 0,
    total: 0,
  };

  const emptyTokenBucket = () => ({
    TYC: { raw: "0", formatted: "0", decimals: 18 },
    USDC: { raw: "0", formatted: "0", decimals: 6 },
    cUSD: { raw: "0", formatted: "0", decimals: 6 },
    USDT: { raw: "0", formatted: "0", decimals: 6 },
  });

  const sumPurchaseRows = async (rows) => {
    const rawTotals = { TYC: 0n, USDC: 0n, cUSD: 0n, USDT: 0n };
    for (const row of rows) {
      const token = Number(row.payment_token);
      const label =
        token === 0 ? "TYC" : token === 1 ? "USDC" : token === 2 ? "cUSD" : token === 3 ? "USDT" : null;
      if (!label) continue;
      try {
        rawTotals[label] += BigInt(String(row.amount || "0"));
      } catch {
        /* ignore */
      }
    }
    const { formatUnits } = await import("ethers");
    const byCurrency = emptyTokenBucket();
    for (const [label, raw] of Object.entries(rawTotals)) {
      const decimals = label === "TYC" ? 18 : 6;
      byCurrency[label] = {
        raw: raw.toString(),
        formatted: formatUnits(raw, decimals),
        decimals,
      };
    }
    return byCurrency;
  };

  const revenue = {
    method: "lifetime_inflows_not_treasury_balance",
    note:
      "Revenue is lifetime purchase/sale inflows (DB + on-chain sale events). Treasury balance after withdrawFunds is leftover cash, not revenue.",
    // All recorded soft-perk / tip purchases (not filtered by noisy is_minipay join)
    softPerksAll: {
      purchaseCount: 0,
      byCurrency: emptyTokenBucket(),
      scope: "all_soft_perk_purchases",
    },
    tipPacksAll: {
      purchaseCount: 0,
      usdcFormatted: "0",
      scope: "all_tip_pack_purchases",
    },
    // Subset linked to is_minipay games (often undercounts if game_id null)
    minipaySoftPerks: {
      purchaseCount: 0,
      byCurrency: emptyTokenBucket(),
    },
    minipayTipPacks: {
      purchaseCount: 0,
      usdcFormatted: "0",
    },
    celoShop: null,
    houseFees: {
      included: false,
      note:
        "5% house cut on staked games is not included yet (stake is on-chain only).",
    },
  };

  const dataQuality = {
    isMinipayTagNoisy: true,
    warning:
      "MiniPay users = human accounts registered on/after 27 Jun 2026 (almost all new growth is MiniPay). Game counts still use games.is_minipay (historically noisy for Celo main-app creates).",
  };

  // Primary MiniPay user metric: all human registrations since MiniPay cutover.
  try {
    const hasUsersTable = await db.schema.hasTable("users");
    if (hasUsersTable) {
      const [sinceAll, sinceHumans] = await Promise.all([
        db("users").where("created_at", ">=", MINIPAY_USER_SINCE).count("* as count").first(),
        db("users")
          .where("created_at", ">=", MINIPAY_USER_SINCE)
          .where(function () {
            this.whereNull("username").orWhere("username", "not like", "AI_%");
          })
          .count("* as count")
          .first(),
      ]);
      users.registeredSinceCutoffIncludingAi = Number(sinceAll?.count ?? 0);
      users.registeredSinceCutoff = Number(sinceHumans?.count ?? 0);
      // Headline / backward-compat fields for the public page.
      users.distinctPlayers = users.registeredSinceCutoff;
      users.distinctHumanPlayers = users.registeredSinceCutoff;
    }
  } catch (regErr) {
    logger.warn({ err: regErr }, "getMinipayStats registered-since cutoff query failed");
  }

  if (hasMinipayCol && hasPlayers) {
    try {
      const hasUsersTable = await db.schema.hasTable("users");
      const taggedPlayers = await db("game_players as gp")
        .join("games as g", "g.id", "gp.game_id")
        .where("g.is_minipay", true)
        .whereNotNull("gp.user_id")
        .countDistinct("gp.user_id as count")
        .first();
      users.taggedPlayersIncludingAi = Number(taggedPlayers?.count ?? 0);

      const joinRow = await db("game_players as gp")
        .join("games as g", "g.id", "gp.game_id")
        .where("g.is_minipay", true)
        .count("* as count")
        .first();
      transactions.playerJoins = Number(joinRow?.count ?? 0);

      if (hasUsersTable) {
        const humanCreators = await db("games as g")
          .join("users as u", "u.id", "g.creator_id")
          .where("g.is_minipay", true)
          .where(function () {
            this.whereNull("u.username").orWhere("u.username", "not like", "AI_%");
          })
          .countDistinct("g.creator_id as count")
          .first();
        users.distinctHumanCreators = Number(humanCreators?.count ?? 0);

        const humanJoins = await db("game_players as gp")
          .join("games as g", "g.id", "gp.game_id")
          .join("users as u", "u.id", "gp.user_id")
          .where("g.is_minipay", true)
          .where(function () {
            this.whereNull("u.username").orWhere("u.username", "not like", "AI_%");
          })
          .count("* as count")
          .first();
        transactions.humanPlayerJoins = Number(humanJoins?.count ?? 0);
      } else {
        users.distinctHumanCreators = users.distinctCreators;
        transactions.humanPlayerJoins = transactions.playerJoins;
      }
    } catch (userErr) {
      logger.warn({ err: userErr }, "getMinipayStats users/joins query failed");
    }
  }

  if (hasMinipayCol && hasContractGameId) {
    try {
      const onChain = await db("games")
        .where("is_minipay", true)
        .whereNotNull("contract_game_id")
        .count("* as count")
        .first();
      transactions.onChainGames = Number(onChain?.count ?? 0);
    } catch (e) {
      logger.warn({ err: e }, "getMinipayStats onChainGames failed");
    }
  }

  // Lifetime in-app purchases — do NOT require is_minipay join (that was returning 0).
  if (hasSoftPerks) {
    try {
      const allRows = await db("soft_perk_purchases").select(
        "amount",
        "payment_token",
        "entitlement",
        "game_id"
      );
      transactions.softPerkPurchases = allRows.length;
      const nonTip = allRows.filter((r) => r.entitlement !== "ai_tip_pack");
      revenue.softPerksAll.purchaseCount = nonTip.length;
      revenue.softPerksAll.byCurrency = await sumPurchaseRows(nonTip);

      if (hasMinipayCol) {
        const gameIds = allRows.map((r) => r.game_id).filter((id) => id != null);
        if (gameIds.length > 0) {
          const mpIds = new Set(
            (await db("games").where("is_minipay", true).whereIn("id", gameIds).pluck("id")).map(Number)
          );
          const linked = allRows.filter((r) => r.game_id != null && mpIds.has(Number(r.game_id)));
          const linkedNonTip = linked.filter((r) => r.entitlement !== "ai_tip_pack");
          revenue.minipaySoftPerks.purchaseCount = linkedNonTip.length;
          revenue.minipaySoftPerks.byCurrency = await sumPurchaseRows(linkedNonTip);
        }
      }
    } catch (e) {
      logger.warn({ err: e }, "getMinipayStats soft perks revenue failed");
    }
  }

  if (hasTipPacks) {
    try {
      const tipRows = await db("game_ai_tip_pack_purchases").select("amount_usdc", "game_id");
      transactions.tipPackPurchases = tipRows.length;
      revenue.tipPacksAll.purchaseCount = tipRows.length;
      let tipSum = 0;
      for (const row of tipRows) {
        const n = Number(row.amount_usdc);
        if (Number.isFinite(n)) tipSum += n;
      }
      revenue.tipPacksAll.usdcFormatted = tipSum.toFixed(6);

      if (hasMinipayCol) {
        const linked = await db("game_ai_tip_pack_purchases as tip")
          .join("games as g", "g.id", "tip.game_id")
          .where("g.is_minipay", true)
          .select("tip.amount_usdc");
        revenue.minipayTipPacks.purchaseCount = linked.length;
        let linkedSum = 0;
        for (const row of linked) {
          const n = Number(row.amount_usdc);
          if (Number.isFinite(n)) linkedSum += n;
        }
        revenue.minipayTipPacks.usdcFormatted = linkedSum.toFixed(6);
      }
    } catch (e) {
      logger.warn({ err: e }, "getMinipayStats tip packs failed");
    }
  }

  transactions.total =
    transactions.humanGames +
    transactions.humanPlayerJoins +
    transactions.softPerkPurchases;

  // NFT shop log indexing is too slow for this hot path — use admin sales for that.
  revenue.celoShop = {
    scope: "skipped_on_hot_path",
    note:
      "NFT/collectible shop sale indexing is not run on this endpoint (too slow). Tip packs + soft perks above are DB lifetime inflows.",
    summary: null,
    revenueByCurrency: null,
    rewardAddress: null,
  };

  // Keep legacy tip/soft fields populated from "all" when linked subset is empty
  if (
    revenue.minipayTipPacks.purchaseCount === 0 &&
    revenue.tipPacksAll.purchaseCount > 0
  ) {
    revenue.minipayTipPacks = {
      purchaseCount: revenue.tipPacksAll.purchaseCount,
      usdcFormatted: revenue.tipPacksAll.usdcFormatted,
      note: "Showing all tip packs (is_minipay-linked subset was empty)",
    };
  }
  if (
    revenue.minipaySoftPerks.purchaseCount === 0 &&
    revenue.softPerksAll.purchaseCount > 0
  ) {
    revenue.minipaySoftPerks = {
      purchaseCount: revenue.softPerksAll.purchaseCount,
      byCurrency: revenue.softPerksAll.byCurrency,
      note: "Showing all soft perks (is_minipay-linked subset was empty)",
    };
  }

  note = `${dataQuality.warning} ${note}`;

  let incrementalUsd = 0;
  try {
    incrementalUsd = await sumStableInflowsAfter(ONCHAIN_REVENUE_BASELINE_AT);
  } catch (revErr) {
    logger.warn({ err: revErr }, "getMinipayStats incremental on-chain revenue failed");
  }
  const baselineUsd = Number.isFinite(ONCHAIN_REVENUE_BASELINE_USD) ? ONCHAIN_REVENUE_BASELINE_USD : 106;
  const totalUsd = Math.round((baselineUsd + incrementalUsd) * 100) / 100;
  const headline = {
    users: users.registeredSinceCutoff || users.distinctHumanPlayers || users.distinctPlayers || 0,
    transactions: transactions.total || 0,
    gamesCreated: games.total || 0,
    agents: agents.total || 0,
    onchainRevenueUsd: totalUsd,
    onchainRevenue: {
      baselineUsd,
      incrementalUsd,
      totalUsd,
      baselineAt: ONCHAIN_REVENUE_BASELINE_AT,
      method: "baseline_plus_db_inflows_after",
    },
  };

  return {
    headline,
    users,
    transactions,
    revenue,
    dataQuality,
    minipayGames: games,
    gamesOverTime,
    agents,
    range: {
      start: toIsoDateString(rangeStart),
      end: toIsoDateString(rangeEnd),
    },
    excludes: ["current_treasury_balances", "cash", "token_holdings", "game_balances"],
    note,
    generatedAt: now.toISOString(),
  };
}
