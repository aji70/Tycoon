/**
 * Arena XP service (stored in user_agents.elo_rating / elo_peak for DB compatibility).
 *
 * Uses standard Elo-style updates (K=32) as XP gain/loss from match outcomes.
 * Integrates with agentGameRunner to auto-update agents on match completion.
 */

import db from "../config/database.js";
import logger from "../config/logger.js";

const K_FACTOR = 32; // Rating adjustment magnitude

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

/** Tier label from current XP (elo_rating). */
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
