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
 */
export async function getDashboard() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const [
    totalGames,
    gamesByStatus,
    gamesCreatedToday,
    gamesFinishedToday,
    gamesCreatedThisWeek,
    recentEvents,
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
  ]);

  const statusCounts = Object.fromEntries(
    gamesByStatus.map((r) => [r.status, Number(r.count)])
  );

  const eventCounts = Array.isArray(recentEvents)
    ? Object.fromEntries(recentEvents.map((r) => [r.event_type, Number(r.count)]))
    : {};

  return {
    games: {
      total: Number(totalGames?.count ?? 0),
      byStatus: statusCounts,
      createdToday: Number(gamesCreatedToday?.count ?? 0),
      finishedToday: Number(gamesFinishedToday?.count ?? 0),
      createdThisWeek: Number(gamesCreatedThisWeek?.count ?? 0),
    },
    events: eventCounts,
    generatedAt: now.toISOString(),
  };
}
