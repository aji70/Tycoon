/**
 * Arena pending challenges (no matchmaking queue).
 */

import db from "../config/database.js";
import logger from "../config/logger.js";

const PENDING_CHALLENGE_TABLE = "arena_pending_challenges";
const CHALLENGE_TTL_MS = 48 * 60 * 60 * 1000;
const MAX_BATCH_OPPONENTS = 7;

async function loadAgent(agentId) {
  return db("user_agents").where("id", Number(agentId)).first();
}

/**
 * Replace prior pending challenges issued by this challenger agent.
 */
async function cancelPendingForChallengerAgent(challengerAgentId) {
  await db(PENDING_CHALLENGE_TABLE)
    .where({ challenger_agent_id: challengerAgentId, status: "PENDING" })
    .update({ status: "CANCELLED", updated_at: db.fn.now() });
}

/**
 * Create up to 7 pending challenges. Opponent owners must accept in Incoming tab.
 */
export async function createPendingChallengeBatch(challengerAgentId, challengerUserId, opponentAgentIds) {
  const challenger = await loadAgent(challengerAgentId);
  if (!challenger || challenger.user_id !== challengerUserId) {
    throw new Error("Challenger agent not found or not yours");
  }

  const raw = Array.isArray(opponentAgentIds) ? opponentAgentIds : [];
  const unique = [...new Set(raw.map(Number).filter(Boolean))].filter((id) => id !== Number(challengerAgentId));

  if (unique.length === 0) throw new Error("At least one opponent agent is required");
  if (unique.length > MAX_BATCH_OPPONENTS) {
    throw new Error(`You can challenge at most ${MAX_BATCH_OPPONENTS} agents at once`);
  }

  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  const created = [];
  const skipped = [];

  await cancelPendingForChallengerAgent(challengerAgentId);

  for (const oppId of unique) {
    const opponent = await loadAgent(oppId);
    if (!opponent) {
      skipped.push({ opponent_agent_id: oppId, reason: "Agent not found" });
      continue;
    }
    if (opponent.user_id === challengerUserId) {
      skipped.push({ opponent_agent_id: oppId, reason: "Cannot challenge your own agent" });
      continue;
    }

    const insertResult = await db(PENDING_CHALLENGE_TABLE).insert({
      challenger_agent_id: challengerAgentId,
      challenged_agent_id: oppId,
      challenger_user_id: challengerUserId,
      challenged_user_id: opponent.user_id,
      status: "PENDING",
      expires_at: expiresAt,
    });
    const insertId = Array.isArray(insertResult) ? insertResult[0] : insertResult;
    const row = insertId != null ? await db(PENDING_CHALLENGE_TABLE).where("id", insertId).first() : null;
    if (row) created.push(row);
  }

  logger.info(
    { challengerAgentId, created: created.length, skipped: skipped.length },
    "Arena pending challenges batch created"
  );

  return { challenges: created.filter(Boolean), skipped, expires_at: expiresAt };
}

export async function listIncomingChallenges(userId) {
  const now = new Date();
  return db(PENDING_CHALLENGE_TABLE)
    .where({ challenged_user_id: userId, status: "PENDING" })
    .where("expires_at", ">", now)
    .orderBy("created_at", "desc");
}

export async function listOutgoingChallenges(userId) {
  const now = new Date();
  return db(PENDING_CHALLENGE_TABLE)
    .where({ challenger_user_id: userId, status: "PENDING" })
    .where("expires_at", ">", now)
    .orderBy("created_at", "desc");
}

async function cancelOtherPendingInvolvingAgents(agentAId, agentBId, exceptChallengeId) {
  await db(PENDING_CHALLENGE_TABLE)
    .where("status", "PENDING")
    .where("id", "!=", exceptChallengeId)
    .where((q) => {
      q.whereIn("challenger_agent_id", [agentAId, agentBId]).orWhereIn("challenged_agent_id", [agentAId, agentBId]);
    })
    .update({ status: "CANCELLED", updated_at: db.fn.now() });
}

/**
 * Challenged owner accepts: creates 2-player AGENT_VS_AGENT game and marks challenge accepted.
 */
export async function acceptPendingChallenge(challengeId, acceptingUserId, createGameFn) {
  const row = await db(PENDING_CHALLENGE_TABLE).where("id", challengeId).first();
  if (!row || row.status !== "PENDING") throw new Error("Challenge not found or not pending");
  if (row.challenged_user_id !== acceptingUserId) throw new Error("Not authorized to accept this challenge");
  if (new Date(row.expires_at) < new Date()) {
    await db(PENDING_CHALLENGE_TABLE).where("id", challengeId).update({ status: "EXPIRED", updated_at: db.fn.now() });
    throw new Error("Challenge expired");
  }

  const challengerAgent = await loadAgent(row.challenger_agent_id);
  const challengedAgent = await loadAgent(row.challenged_agent_id);
  if (!challengerAgent || !challengedAgent) throw new Error("Agent missing");

  await cancelOtherPendingInvolvingAgents(Number(row.challenger_agent_id), Number(row.challenged_agent_id), row.id);

  const game = await createGameFn({
    creatorUserId: row.challenger_user_id,
    challengerUserAgentId: row.challenger_agent_id,
    opponentUserAgentId: row.challenged_agent_id,
    challengerName: challengerAgent.name || "Challenger",
    opponentName: challengedAgent.name || "Opponent",
  });

  await db(PENDING_CHALLENGE_TABLE)
    .where("id", challengeId)
    .update({
      status: "ACCEPTED",
      game_id: game.id,
      updated_at: db.fn.now(),
    });

  return { game, challenge_id: challengeId };
}

export async function declinePendingChallenge(challengeId, decliningUserId) {
  const row = await db(PENDING_CHALLENGE_TABLE).where("id", challengeId).first();
  if (!row || row.status !== "PENDING") throw new Error("Challenge not found");
  if (row.challenged_user_id !== decliningUserId) throw new Error("Not authorized");
  await db(PENDING_CHALLENGE_TABLE)
    .where("id", challengeId)
    .update({ status: "DECLINED", updated_at: db.fn.now() });
}

export async function cancelOutgoingChallenge(challengeId, challengerUserId) {
  const row = await db(PENDING_CHALLENGE_TABLE).where("id", challengeId).first();
  if (!row || row.status !== "PENDING") throw new Error("Challenge not found");
  if (row.challenger_user_id !== challengerUserId) throw new Error("Not authorized");
  await db(PENDING_CHALLENGE_TABLE)
    .where("id", challengeId)
    .update({ status: "CANCELLED", updated_at: db.fn.now() });
}
