/**
 * Arena Controller
 *
 * Handles HTTP endpoints for Agent Arena:
 * - Discovery, leaderboard, XP stats, on-chain start-game, pending challenges (legacy), match history
 */

import db from "../config/database.js";
import * as eloService from "../services/eloService.js";
import * as matchmakingService from "../services/matchmakingService.js";
import * as arenaAgentService from "../services/arenaAgentService.js";
import { createTwoPlayerAgentArenaGame } from "../services/agentArenaGameFactory.js";
import { emitGameUpdate } from "../utils/socketHelpers.js";
import logger from "../config/logger.js";

function enrichArenaAgent(agent) {
  return eloService.enrichAgentForArenaUi(agent);
}

async function enrichChallengeRow(row) {
  if (!row) return row;
  const ca = await db("user_agents").where("id", row.challenger_agent_id).first();
  const cd = await db("user_agents").where("id", row.challenged_agent_id).first();
  const ua = ca ? await db("users").where("id", ca.user_id).select("username").first() : null;
  const ub = cd ? await db("users").where("id", cd.user_id).select("username").first() : null;
  return {
    ...row,
    challenger_agent_name: ca?.name || null,
    challenged_agent_name: cd?.name || null,
    challenger_username: ua?.username || null,
    challenged_username: ub?.username || null,
  };
}

// ============================================================================
// Discovery & Leaderboard
// ============================================================================

/**
 * GET /api/arena/agents
 * Paginated list of public agents with XP and stats.
 * Excludes agents owned by the current user (if authenticated).
 * Query: approved_to_spend=1 — only agents whose owners enabled tournament spending permission.
 */
export async function getPublicAgents(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(req.query.page_size) || 20));
    const offset = (page - 1) * pageSize;
    const userId = req.userId || null; // From auth middleware
    const approvedToSpend = req.query.approved_to_spend === "1" || req.query.approved_to_spend === "true";

    let query = db("user_agents").where("user_agents.is_public", true);

    if (approvedToSpend) {
      query = query
        .innerJoin("agent_tournament_permissions as atp", "atp.user_agent_id", "user_agents.id")
        .where("atp.enabled", true);
    }

    // Exclude current user's agents if authenticated
    if (userId) {
      query = query.whereNot("user_agents.user_id", userId);
    }

    const baseSelect = [
      "user_agents.id",
      "user_agents.name",
      "user_agents.erc8004_agent_id",
      "user_agents.elo_rating",
      "user_agents.elo_peak",
      "user_agents.arena_wins",
      "user_agents.arena_losses",
      "user_agents.arena_draws",
      "user_agents.user_id",
      db.raw("users.username"),
    ];
    if (approvedToSpend) {
      baseSelect.push(
        "atp.max_entry_fee_usdc",
        "atp.daily_cap_usdc",
        "atp.chain"
      );
    }
    const agents = await query
      .select(baseSelect)
      .join("users", "user_agents.user_id", "users.id")
      .orderBy("user_agents.elo_rating", "desc")
      .limit(pageSize)
      .offset(offset);

    let totalQuery = db("user_agents").where("user_agents.is_public", true);
    if (approvedToSpend) {
      totalQuery = totalQuery
        .innerJoin("agent_tournament_permissions as atp", "atp.user_agent_id", "user_agents.id")
        .where("atp.enabled", true);
    }
    if (userId) {
      totalQuery = totalQuery.whereNot("user_agents.user_id", userId);
    }
    const totalCount = await totalQuery.count("* as count").first();

    const enriched = agents.map((agent) => enrichArenaAgent(agent));

    res.json({
      success: true,
      agents: enriched,
      page,
      page_size: pageSize,
      total_count: totalCount?.count || 0,
      total_pages: Math.ceil((totalCount?.count || 0) / pageSize),
    });
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack }, "Failed to fetch public agents");
    const message = err?.message?.includes("Unknown column")
      ? "Arena database schema not initialized. Please run migrations."
      : err?.message || "Internal server error";
    res.status(500).json({ success: false, error: message });
  }
}

/**
 * GET /api/arena/agents/:agentId
 * Single agent profile with recent match history.
 */
export async function getAgentProfile(req, res) {
  try {
    const { agentId } = req.params;

    const agent = await db("user_agents")
      .where("id", agentId)
      .select(
        "user_agents.id",
        "user_agents.name",
        "user_agents.erc8004_agent_id",
        "user_agents.elo_rating",
        "user_agents.elo_peak",
        "user_agents.arena_wins",
        "user_agents.arena_losses",
        "user_agents.arena_draws",
        "user_agents.is_public",
        "user_agents.user_id",
        db.raw("users.username")
      )
      .join("users", "user_agents.user_id", "users.id")
      .first();

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Recent matches (last 20)
    const matches = await db("agent_arena_matches")
      .where((q) => {
        q.where("agent_a_id", agentId).orWhere("agent_b_id", agentId);
      })
      .where("status", "COMPLETED")
      .orderBy("completed_at", "desc")
      .limit(20);

    const enrichedMatches = matches.map((match) => {
      const isAgentA = match.agent_a_id === parseInt(agentId);
      const eloChange = isAgentA ? match.elo_change_a : match.elo_change_b;
      const eloBefore = isAgentA ? match.elo_before_a : match.elo_before_b;
      return {
        match_id: match.id,
        opponent_agent_id: isAgentA ? match.agent_b_id : match.agent_a_id,
        opponent_user_id: isAgentA ? match.agent_b_user_id : match.agent_a_user_id,
        result: match.winner_agent_id === parseInt(agentId) ? "WIN" : match.winner_agent_id === null ? "DRAW" : "LOSS",
        xp_change: eloChange,
        elo_change: eloChange,
        xp_before: eloBefore,
        elo_before: eloBefore,
        completed_at: match.completed_at,
      };
    });

    res.json({
      agent: enrichArenaAgent(agent),
      recent_matches: enrichedMatches,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to fetch agent profile");
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
}

/**
 * GET /api/arena/leaderboard
 * Top agents by XP (stored as elo_rating) with rank and tier.
 */
export async function getLeaderboard(req, res) {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));

    const agents = await db("user_agents")
      .where("is_public", true)
      .select(
        "user_agents.id",
        "user_agents.name",
        "user_agents.erc8004_agent_id",
        "user_agents.elo_rating",
        "user_agents.elo_peak",
        "user_agents.arena_wins",
        "user_agents.arena_losses",
        "user_agents.arena_draws",
        "user_agents.user_id",
        db.raw("users.username")
      )
      .join("users", "user_agents.user_id", "users.id")
      .orderBy("user_agents.elo_rating", "desc")
      .limit(limit);

    const leaderboard = agents.map((agent, index) => ({
      rank: index + 1,
      ...enrichArenaAgent(agent),
    }));

    res.json({ success: true, leaderboard });
  } catch (err) {
    logger.error({ err: err?.message, stack: err?.stack }, "Failed to fetch leaderboard");
    const message = err?.message?.includes("Unknown column")
      ? "Arena database schema not initialized. Please run migrations."
      : err?.message || "Internal server error";
    res.status(500).json({ success: false, error: message });
  }
}

// ============================================================================
// Pending challenges (replaces matchmaking queue)
// ============================================================================

/** @deprecated */
export function joinQueue(_req, res) {
  res.status(410).json({ error: "Matchmaking queue removed. Use POST /arena/start-game from Discover." });
}

/** @deprecated */
export function leaveQueue(_req, res) {
  res.status(410).json({ error: "Matchmaking queue removed." });
}

/** @deprecated */
export function challengeAgent(_req, res) {
  res.status(410).json({ error: "Use POST /arena/start-game with opponent_agent_ids." });
}

/**
 * POST /api/arena/start-game
 * Body: { challenger_agent_id, opponent_agent_ids: number[], stake_amount_usdc?: number } (1–7 opponents; optional stake in USDC)
 */
export async function startOnchainArenaGameHandler(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { challenger_agent_id, opponent_agent_ids, stake_amount_usdc } = req.body || {};
    if (!challenger_agent_id) return res.status(400).json({ error: "challenger_agent_id required" });

    const result = await matchmakingService.createMultiAgentOnchainArenaGame(
      Number(challenger_agent_id),
      userId,
      opponent_agent_ids,
      stake_amount_usdc
    );

    const io = req.app.get("io");
    if (io && result?.gameCode) emitGameUpdate(io, result.gameCode);

    res.status(201).json({
      success: true,
      game_id: result.gameId,
      game_code: result.gameCode,
      board_type: result.boardType,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "startOnchainArenaGame failed");
    res.status(400).json({ error: err?.message || "Failed to start arena game" });
  }
}

/**
 * POST /api/arena/pending-challenges
 * Body: { challenger_agent_id, opponent_agent_ids: number[] } (max 7)
 */
export async function createPendingChallengeBatchHandler(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { challenger_agent_id, opponent_agent_ids } = req.body || {};
    if (!challenger_agent_id) return res.status(400).json({ error: "challenger_agent_id required" });

    const result = await arenaAgentService.createPendingChallengeBatch(
      Number(challenger_agent_id),
      userId,
      opponent_agent_ids
    );

    const enriched = await Promise.all((result.challenges || []).map((r) => enrichChallengeRow(r)));

    res.status(201).json({
      success: true,
      challenges: enriched,
      skipped: result.skipped,
      expires_at: result.expires_at,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "createPendingChallengeBatch failed");
    res.status(400).json({ error: err?.message || "Failed to create challenges" });
  }
}

/**
 * GET /api/arena/pending-challenges/incoming
 */
export async function listIncomingPending(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const rows = await arenaAgentService.listIncomingChallenges(userId);
    const enriched = await Promise.all(rows.map((r) => enrichChallengeRow(r)));
    res.json({ success: true, challenges: enriched });
  } catch (err) {
    logger.error({ err: err?.message }, "listIncomingPending failed");
    res.status(500).json({ error: err?.message || "Failed" });
  }
}

/**
 * GET /api/arena/pending-challenges/outgoing
 */
export async function listOutgoingPending(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const rows = await arenaAgentService.listOutgoingChallenges(userId);
    const enriched = await Promise.all(rows.map((r) => enrichChallengeRow(r)));
    res.json({ success: true, challenges: enriched });
  } catch (err) {
    logger.error({ err: err?.message }, "listOutgoingPending failed");
    res.status(500).json({ error: err?.message || "Failed" });
  }
}

/**
 * POST /api/arena/pending-challenges/:id/accept
 */
export async function acceptPendingChallengeHandler(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const challengeId = Number(req.params.id);
    if (!challengeId) return res.status(400).json({ error: "Invalid challenge id" });

    const { game } = await arenaAgentService.acceptPendingChallenge(challengeId, userId, async (payload) => {
      const g = await createTwoPlayerAgentArenaGame(payload);
      const io = req.app.get("io");
      if (io && g?.code) emitGameUpdate(io, g.code);
      return g;
    });

    res.status(201).json({
      success: true,
      game_id: game.id,
      game_code: game.code,
      board_type: "3d_desktop",
    });
  } catch (err) {
    logger.error({ err: err?.message }, "acceptPendingChallenge failed");
    res.status(400).json({ error: err?.message || "Failed to accept" });
  }
}

/**
 * POST /api/arena/pending-challenges/:id/decline
 */
export async function declinePendingChallengeHandler(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    await arenaAgentService.declinePendingChallenge(Number(req.params.id), userId);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err: err?.message }, "declinePendingChallenge failed");
    res.status(400).json({ error: err?.message || "Failed" });
  }
}

/**
 * POST /api/arena/pending-challenges/:id/cancel
 */
export async function cancelPendingChallengeHandler(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    await arenaAgentService.cancelOutgoingChallenge(Number(req.params.id), userId);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err: err?.message }, "cancelPendingChallenge failed");
    res.status(400).json({ error: err?.message || "Failed" });
  }
}

// ============================================================================
// Match History
// ============================================================================

/**
 * GET /api/arena/matches
 * Recent arena matches (public, paginated).
 */
export async function getRecentMatches(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(req.query.page_size) || 20));
    const offset = (page - 1) * pageSize;

    const matches = await db("agent_arena_matches")
      .where("status", "COMPLETED")
      .select(
        "agent_arena_matches.id",
        "agent_arena_matches.agent_a_id",
        "agent_arena_matches.agent_b_id",
        "agent_arena_matches.winner_agent_id",
        "agent_arena_matches.elo_change_a",
        "agent_arena_matches.elo_change_b",
        "agent_arena_matches.completed_at",
        db.raw("agents_a.name as agent_a_name"),
        db.raw("agents_b.name as agent_b_name"),
        db.raw("agents_a.elo_rating as agent_a_elo_after"),
        db.raw("agents_b.elo_rating as agent_b_elo_after")
      )
      .join(db.raw("user_agents as agents_a on agent_arena_matches.agent_a_id = agents_a.id"))
      .join(db.raw("user_agents as agents_b on agent_arena_matches.agent_b_id = agents_b.id"))
      .orderBy("agent_arena_matches.completed_at", "desc")
      .limit(pageSize)
      .offset(offset);

    const totalCount = await db("agent_arena_matches")
      .where("status", "COMPLETED")
      .count("* as count")
      .first();

    res.json({
      matches,
      page,
      page_size: pageSize,
      total_count: totalCount?.count || 0,
      total_pages: Math.ceil((totalCount?.count || 0) / pageSize),
    });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to fetch recent matches");
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
}

/**
 * GET /api/arena/matches/:matchId
 * Single match with game state link.
 */
export async function getMatchDetails(req, res) {
  try {
    const { matchId } = req.params;

    const match = await db("agent_arena_matches")
      .where("id", matchId)
      .select(
        "agent_arena_matches.id",
        "agent_arena_matches.game_id",
        "agent_arena_matches.agent_a_id",
        "agent_arena_matches.agent_b_id",
        "agent_arena_matches.agent_a_user_id",
        "agent_arena_matches.agent_b_user_id",
        "agent_arena_matches.winner_agent_id",
        "agent_arena_matches.status",
        "agent_arena_matches.elo_change_a",
        "agent_arena_matches.elo_change_b",
        "agent_arena_matches.elo_before_a",
        "agent_arena_matches.elo_before_b",
        "agent_arena_matches.started_at",
        "agent_arena_matches.completed_at",
        db.raw("agents_a.name as agent_a_name"),
        db.raw("agents_b.name as agent_b_name"),
        db.raw("users_a.username as agent_a_username"),
        db.raw("users_b.username as agent_b_username")
      )
      .join(db.raw("user_agents as agents_a on agent_arena_matches.agent_a_id = agents_a.id"))
      .join(db.raw("user_agents as agents_b on agent_arena_matches.agent_b_id = agents_b.id"))
      .join(db.raw("users as users_a on agent_arena_matches.agent_a_user_id = users_a.id"))
      .join(db.raw("users as users_b on agent_arena_matches.agent_b_user_id = users_b.id"))
      .first();

    if (!match) return res.status(404).json({ error: "Match not found" });

    res.json({
      match: {
        ...match,
        agent_a_elo_after: match.elo_before_a + match.elo_change_a,
        agent_b_elo_after: match.elo_before_b + match.elo_change_b,
        agent_a_xp_after: match.elo_before_a + match.elo_change_a,
        agent_b_xp_after: match.elo_before_b + match.elo_change_b,
        xp_change_a: match.elo_change_a,
        xp_change_b: match.elo_change_b,
        xp_before_a: match.elo_before_a,
        xp_before_b: match.elo_before_b,
      },
    });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to fetch match details");
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
}

/**
 * GET /api/arena/my-matches
 * Current user's agent match history (requires auth).
 */
export async function getMyMatches(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(req.query.page_size) || 20));
    const offset = (page - 1) * pageSize;

    const matches = await db("agent_arena_matches")
      .where("status", "COMPLETED")
      .where((q) => {
        q.where("agent_a_user_id", userId).orWhere("agent_b_user_id", userId);
      })
      .select(
        "agent_arena_matches.id",
        "agent_arena_matches.agent_a_id",
        "agent_arena_matches.agent_b_id",
        "agent_arena_matches.winner_agent_id",
        "agent_arena_matches.elo_change_a",
        "agent_arena_matches.elo_change_b",
        "agent_arena_matches.completed_at",
        db.raw("agents_a.name as agent_a_name"),
        db.raw("agents_b.name as agent_b_name")
      )
      .join(db.raw("user_agents as agents_a on agent_arena_matches.agent_a_id = agents_a.id"))
      .join(db.raw("user_agents as agents_b on agent_arena_matches.agent_b_id = agents_b.id"))
      .orderBy("agent_arena_matches.completed_at", "desc")
      .limit(pageSize)
      .offset(offset);

    const totalCount = await db("agent_arena_matches")
      .where("status", "COMPLETED")
      .where((q) => {
        q.where("agent_a_user_id", userId).orWhere("agent_b_user_id", userId);
      })
      .count("* as count")
      .first();

    res.json({
      matches,
      page,
      page_size: pageSize,
      total_count: totalCount?.count || 0,
      total_pages: Math.ceil((totalCount?.count || 0) / pageSize),
    });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to fetch user's matches");
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
}

/**
 * POST /api/arena/start-challenge/:opponentAgentId
 * Immediately start an agent vs agent game (challenge mode).
 * Returns the game ID for routing to the board.
 */
export async function startChallenge(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { user_agent_id } = req.body;
    const { opponentAgentId } = req.params;

    if (!user_agent_id || !opponentAgentId) {
      return res.status(400).json({ error: "user_agent_id and opponentAgentId required" });
    }

    // Verify your agent exists and is yours
    const yourAgent = await db("user_agents")
      .where({ id: user_agent_id, user_id: userId })
      .first();
    if (!yourAgent) {
      return res.status(403).json({ error: "Agent does not belong to this user" });
    }

    // Verify opponent agent exists
    const opponentAgent = await db("user_agents")
      .where("id", parseInt(opponentAgentId))
      .first();
    if (!opponentAgent) {
      return res.status(404).json({ error: "Opponent agent not found" });
    }

    // Create AGENT_VS_AGENT game via matchmaking service
    const result = await matchmakingService.createDirectChallenge(user_agent_id, userId, parseInt(opponentAgentId));

    res.status(201).json({
      success: true,
      game_id: result.gameId,
      game_code: result.gameCode,
      board_type: result.boardType, // "3d_desktop" or "3d_mobile" (detected by backend)
    });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to start challenge");
    res.status(400).json({ error: err?.message || "Failed to start challenge" });
  }
}

/** @deprecated */
export function getQueueStats(_req, res) {
  res.status(410).json({ error: "Matchmaking queue removed." });
}

/**
 * GET /api/arena/debug/schema
 * Debug endpoint: check if arena columns exist.
 */
export async function checkDatabaseSchema(req, res) {
  try {
    const schema = await db.raw("DESCRIBE user_agents");
    const columnNames = (schema[0] || []).map((col) => col.Field);
    const requiredColumns = [
      "id",
      "name",
      "elo_rating",
      "elo_peak",
      "arena_wins",
      "arena_losses",
      "arena_draws",
      "is_public",
    ];
    const missing = requiredColumns.filter((col) => !columnNames.includes(col));

    res.json({
      success: true,
      databaseConnected: true,
      columnCount: columnNames.length,
      allColumnsPresent: missing.length === 0,
      missingColumns: missing,
      actualColumns: columnNames,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to check database schema");
    res.status(500).json({
      success: false,
      databaseConnected: false,
      error: err?.message || "Database connection failed",
    });
  }
}
