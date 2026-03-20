/**
 * Arena XP service (stored in user_agents.elo_rating / elo_peak for DB compatibility).
 *
 * Uses standard Elo-style updates (K=32) as XP gain/loss from match outcomes.
 * Integrates with agentGameRunner to auto-update agents on match completion.
 */

import db from "../config/database.js";
import logger from "../config/logger.js";

const K_FACTOR = 32; // Rating adjustment magnitude

export const ACTIVITY_XP = Object.freeze({
  GAME_CREATED: 10,
  TURN_COMPLETED: 1,
  ROLLED_DOUBLE: 2,
  PROPERTY_BOUGHT: 8,
  HOUSE_BUILT: 6,
  PROPERTY_SOLD: 4,
  TRADE_COMPLETED: 5,
  TOURNAMENT_JOINED: 12,
  TOURNAMENT_MATCH_PLAYED: 8,
  TOURNAMENT_MATCH_WON: 20,
  TOURNAMENT_CHAMPION: 50,
});

/**
 * Calculate expected win probability for player A given both ratings.
 * Ranges 0–1 where 0.5 means equally matched.
 */
export function calculateExpected(ratingA, ratingB) {
  const diff = ratingB - ratingA;
  return 1 / (1 + Math.pow(10, diff / 400));
}

/**
 * Calculate new ratings and changes after a match.
 *
 * @param {number} ratingA - Current rating of player A
 * @param {number} ratingB - Current rating of player B
 * @param {number} scoreA - Match result from A's perspective (1=A wins, 0=B wins, 0.5=draw)
 * @returns {{newRatingA: number, newRatingB: number, changeA: number, changeB: number}}
 */
export function calculateNewRatings(ratingA, ratingB, scoreA) {
  const expectedA = calculateExpected(ratingA, ratingB);
  const expectedB = 1 - expectedA;

  const changeA = Math.round(K_FACTOR * (scoreA - expectedA));
  const changeB = Math.round(K_FACTOR * ((1 - scoreA) - expectedB));

  return {
    newRatingA: Math.max(0, ratingA + changeA),
    newRatingB: Math.max(0, ratingB + changeB),
    changeA,
    changeB,
  };
}

/**
 * Record an agent arena match result and update XP (elo_rating) for both agents.
 *
 * @param {number} agentAId - ID of first agent
 * @param {number} agentBId - ID of second agent
 * @param {number|null} winnerAgentId - ID of winner, or null for draw
 * @param {number} gameId - Associated game ID
 * @returns {Promise<{matchId: number, agentAEloAfter: number, agentBEloAfter: number, changeA: number, changeB: number}>}
 */
export async function recordArenaResult(agentAId, agentBId, winnerAgentId, gameId) {
  const trx = await db.transaction();

  try {
    // Fetch current agent ratings
    const agentA = await trx("user_agents").where("id", agentAId).first();
    const agentB = await trx("user_agents").where("id", agentBId).first();

    if (!agentA || !agentB) {
      throw new Error(`Agent not found: A=${agentAId}, B=${agentBId}`);
    }

    // Determine match score from A's perspective
    let scoreA;
    if (winnerAgentId === agentAId) {
      scoreA = 1; // A wins
    } else if (winnerAgentId === agentBId) {
      scoreA = 0; // B wins
    } else {
      scoreA = 0.5; // Draw
    }

    // Calculate new ratings
    const { newRatingA, newRatingB, changeA, changeB } = calculateNewRatings(
      agentA.elo_rating,
      agentB.elo_rating,
      scoreA
    );

    // Determine wins/losses/draws for stats
    let statsA = { arena_wins: 0, arena_losses: 0, arena_draws: 0 };
    let statsB = { arena_wins: 0, arena_losses: 0, arena_draws: 0 };

    if (winnerAgentId === agentAId) {
      statsA.arena_wins = 1;
      statsB.arena_losses = 1;
    } else if (winnerAgentId === agentBId) {
      statsA.arena_losses = 1;
      statsB.arena_wins = 1;
    } else {
      statsA.arena_draws = 1;
      statsB.arena_draws = 1;
    }

    // Update both agents' ratings and stats
    await trx("user_agents").where("id", agentAId).update({
      elo_rating: newRatingA,
      elo_peak: Math.max(agentA.elo_peak, newRatingA),
      arena_wins: trx.raw("arena_wins + ?", [statsA.arena_wins]),
      arena_losses: trx.raw("arena_losses + ?", [statsA.arena_losses]),
      arena_draws: trx.raw("arena_draws + ?", [statsA.arena_draws]),
    });

    await trx("user_agents").where("id", agentBId).update({
      elo_rating: newRatingB,
      elo_peak: Math.max(agentB.elo_peak, newRatingB),
      arena_wins: trx.raw("arena_wins + ?", [statsB.arena_wins]),
      arena_losses: trx.raw("arena_losses + ?", [statsB.arena_losses]),
      arena_draws: trx.raw("arena_draws + ?", [statsB.arena_draws]),
    });

    // Record match in arena_arena_matches
    const [matchId] = await trx("agent_arena_matches").insert({
      match_type: "ARENA",
      game_id: gameId,
      agent_a_id: agentAId,
      agent_b_id: agentBId,
      agent_a_user_id: agentA.user_id,
      agent_b_user_id: agentB.user_id,
      winner_agent_id: winnerAgentId,
      status: "COMPLETED",
      elo_change_a: changeA,
      elo_change_b: changeB,
      elo_before_a: agentA.elo_rating,
      elo_before_b: agentB.elo_rating,
      started_at: new Date(),
      completed_at: new Date(),
    });

    await trx.commit();

    logger.info(
      {
        matchId,
        agentAId,
        agentBId,
        winnerId: winnerAgentId,
        changeA,
        changeB,
        newRatingA,
        newRatingB,
      },
      "Arena XP match recorded"
    );

    return {
      matchId,
      agentAEloAfter: newRatingA,
      agentBEloAfter: newRatingB,
      changeA,
      changeB,
    };
  } catch (err) {
    await trx.rollback();
    logger.error(
      { err: err?.message, agentAId, agentBId, winnerAgentId, gameId },
      "Failed to record arena result"
    );
    throw err;
  }
}

/** Tier label from raw stored Elo (elo_rating). */
export function getTierName(rating) {
  if (rating >= 1800) return "Legend";
  if (rating >= 1600) return "Diamond";
  if (rating >= 1400) return "Platinum";
  if (rating >= 1200) return "Gold";
  if (rating >= 1000) return "Silver";
  return "Bronze";
}

export function getTierColor(rating) {
  if (rating >= 1800) return "gold";
  if (rating >= 1600) return "cyan";
  if (rating >= 1400) return "purple";
  if (rating >= 1200) return "yellow";
  if (rating >= 1000) return "silver";
  return "brown";
}

const ARENA_ELO_BASELINE = 1000;

/**
 * Arena UI tiers: baseline rating (1000) = Bronze so new agents don't show "Silver".
 */
export function getTierNameArena(eloRating) {
  const r = Number(eloRating);
  const x = Number.isFinite(r) ? r : ARENA_ELO_BASELINE;
  // Arena tiers scaled x10 to heavily spread progression bands.
  if (x >= 13000) return "Legend";
  if (x >= 9500) return "Diamond";
  if (x >= 6500) return "Platinum";
  if (x >= 4000) return "Gold";
  if (x > ARENA_ELO_BASELINE) return "Silver";
  return "Bronze";
}

export function getTierColorArena(eloRating) {
  const r = Number(eloRating);
  const x = Number.isFinite(r) ? r : ARENA_ELO_BASELINE;
  if (x >= 13000) return "gold";
  if (x >= 9500) return "cyan";
  if (x >= 6500) return "purple";
  if (x >= 4000) return "yellow";
  if (x > ARENA_ELO_BASELINE) return "silver";
  return "brown";
}

/**
 * API/UI: XP is "points above starting Elo" (0 at default 1000). Raw elo_rating stays in DB for math.
 */
export function enrichAgentForArenaUi(agent) {
  if (!agent) return agent;
  const wins = Number(agent.arena_wins) || 0;
  const losses = Number(agent.arena_losses) || 0;
  const draws = Number(agent.arena_draws) || 0;
  const total = wins + losses + draws;
  const rawElo = Number(agent.elo_rating);
  const rawPeak = Number(agent.elo_peak);
  const eloSafe = Number.isFinite(rawElo) ? rawElo : ARENA_ELO_BASELINE;
  const peakSafe = Number.isFinite(rawPeak) ? rawPeak : ARENA_ELO_BASELINE;
  const xp = Math.max(0, eloSafe - ARENA_ELO_BASELINE);
  const peak_xp = Math.max(0, peakSafe - ARENA_ELO_BASELINE);
  return {
    ...agent,
    xp,
    peak_xp,
    record: `${wins}W-${losses}L-${draws}D`,
    win_rate_pct: total > 0 ? Math.round((wins / total) * 1000) / 10 : null,
    win_rate: total > 0 ? (wins / total).toFixed(2) : null,
    total_games: total,
    tier: getTierNameArena(eloSafe),
    tier_color: getTierColorArena(eloSafe),
  };
}

async function resolveUserAgentIdForGameUser(gameId, userId, trxOrDb = db) {
  const gp = await trxOrDb("game_players")
    .where({ game_id: Number(gameId), user_id: Number(userId) })
    .select("turn_order")
    .first();
  if (!gp?.turn_order) return null;
  const assignment = await trxOrDb("agent_slot_assignments")
    .where({
      game_id: Number(gameId),
      slot: Number(gp.turn_order),
    })
    .whereNotNull("user_agent_id")
    .select("user_agent_id")
    .first();
  return assignment?.user_agent_id ? Number(assignment.user_agent_id) : null;
}

export async function awardActivityXpByAgentId(userAgentId, points, reason = "activity", trxOrDb = db) {
  const agentId = Number(userAgentId);
  const delta = Math.max(0, Number(points) || 0);
  if (!agentId || delta <= 0) return false;

  const row = await trxOrDb("user_agents").where({ id: agentId }).select("id", "elo_rating", "elo_peak").first();
  if (!row) return false;
  const current = Number(row.elo_rating) || 1000;
  const next = current + delta;
  const peak = Math.max(Number(row.elo_peak) || 1000, next);
  await trxOrDb("user_agents").where({ id: agentId }).update({
    elo_rating: next,
    elo_peak: peak,
    updated_at: trxOrDb.fn.now(),
  });
  logger.debug({ userAgentId: agentId, points: delta, reason }, "Awarded activity XP");
  return true;
}

export async function awardActivityXpByGameUser(gameId, userId, points, reason = "activity", trxOrDb = db) {
  const userAgentId = await resolveUserAgentIdForGameUser(gameId, userId, trxOrDb);
  if (!userAgentId) return false;
  return awardActivityXpByAgentId(userAgentId, points, reason, trxOrDb);
}
