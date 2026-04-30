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
export async function recordEvent(eventType, options = {}) {
  const { entityType = null, entityId = null, payload = null } = options;
  try {
    const hasTable = await db.schema.hasTable("analytics_events");
    if (!hasTable) return;
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
