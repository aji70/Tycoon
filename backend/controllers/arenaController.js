/**
 * Arena Controller
 *
 * Handles HTTP endpoints for Agent Arena:
 * - Discovery, leaderboard, matchmaking queue, match history
 */

import db from "../config/database.js";
import * as eloService from "../services/eloService.js";
import * as matchmakingService from "../services/matchmakingService.js";
import logger from "../config/logger.js";

// ============================================================================
// Discovery & Leaderboard
// ============================================================================

/**
 * GET /api/arena/agents
 * Paginated list of public agents with ELO and stats.
 * Excludes agents owned by the current user (if authenticated).
 */
export async function getPublicAgents(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(req.query.page_size) || 20));
    const offset = (page - 1) * pageSize;
    const userId = req.userId || null; // From auth middleware

    let query = db("user_agents").where("is_public", true);

    // Exclude current user's agents if authenticated
    if (userId) {
      query = query.whereNot("user_id", userId);
    }

    const agents = await query
      .select(
        "user_agents.id",
        "user_agents.name",
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
      .limit(pageSize)
      .offset(offset);

    let totalQuery = db("user_agents").where("is_public", true);
    if (userId) {
      totalQuery = totalQuery.whereNot("user_id", userId);
    }
    const totalCount = await totalQuery.count("* as count").first();

    const enriched = agents.map((agent) => ({
      ...agent,
      tier: eloService.getTierName(agent.elo_rating),
      tier_color: eloService.getTierColor(agent.elo_rating),
      total_games: agent.arena_wins + agent.arena_losses + agent.arena_draws,
      win_rate: agent.arena_wins + agent.arena_losses + agent.arena_draws > 0
        ? (agent.arena_wins / (agent.arena_wins + agent.arena_losses + agent.arena_draws)).toFixed(2)
        : null,
    }));

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
      return {
        match_id: match.id,
        opponent_agent_id: isAgentA ? match.agent_b_id : match.agent_a_id,
        opponent_user_id: isAgentA ? match.agent_b_user_id : match.agent_a_user_id,
        result: match.winner_agent_id === parseInt(agentId) ? "WIN" : match.winner_agent_id === null ? "DRAW" : "LOSS",
        elo_change: isAgentA ? match.elo_change_a : match.elo_change_b,
        elo_before: isAgentA ? match.elo_before_a : match.elo_before_b,
        completed_at: match.completed_at,
      };
    });

    res.json({
      agent: {
        ...agent,
        tier: eloService.getTierName(agent.elo_rating),
        tier_color: eloService.getTierColor(agent.elo_rating),
        total_games: agent.arena_wins + agent.arena_losses + agent.arena_draws,
        win_rate: agent.arena_wins + agent.arena_losses + agent.arena_draws > 0
          ? (agent.arena_wins / (agent.arena_wins + agent.arena_losses + agent.arena_draws)).toFixed(2)
          : null,
      },
      recent_matches: enrichedMatches,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to fetch agent profile");
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
}

/**
 * GET /api/arena/leaderboard
 * Top 50 agents by ELO with rank and tier.
 */
export async function getLeaderboard(req, res) {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));

    const agents = await db("user_agents")
      .where("is_public", true)
      .select(
        "user_agents.id",
        "user_agents.name",
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
      ...agent,
      tier: eloService.getTierName(agent.elo_rating),
      tier_color: eloService.getTierColor(agent.elo_rating),
      total_games: agent.arena_wins + agent.arena_losses + agent.arena_draws,
      win_rate: agent.arena_wins + agent.arena_losses + agent.arena_draws > 0
        ? (agent.arena_wins / (agent.arena_wins + agent.arena_losses + agent.arena_draws)).toFixed(2)
        : null,
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
// Matchmaking Queue
// ============================================================================

/**
 * POST /api/arena/queue
 * Join matchmaking queue with your agent (requires auth).
 */
export async function joinQueue(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { user_agent_id } = req.body;
    if (!user_agent_id) return res.status(400).json({ error: "user_agent_id required" });

    const result = await matchmakingService.joinQueue(user_agent_id, userId);

    res.status(201).json({
      queue_entry_id: result.queueEntryId,
      expires_at: result.expiresAt,
      message: "Joined matchmaking queue",
    });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to join queue");
    res.status(400).json({ error: err?.message || "Failed to join queue" });
  }
}

/**
 * DELETE /api/arena/queue
 * Leave matchmaking queue (requires auth).
 */
export async function leaveQueue(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { user_agent_id } = req.body;
    if (!user_agent_id) return res.status(400).json({ error: "user_agent_id required" });

    // Verify ownership
    const agent = await db("user_agents").where("id", user_agent_id).first();
    if (!agent || agent.user_id !== userId) {
      return res.status(403).json({ error: "Agent does not belong to this user" });
    }

    await matchmakingService.leaveQueue(user_agent_id);

    res.json({ message: "Left matchmaking queue" });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to leave queue");
    res.status(400).json({ error: err?.message || "Failed to leave queue" });
  }
}

/**
 * POST /api/arena/challenge/:opponentAgentId
 * Direct challenge another agent (requires auth).
 */
export async function challengeAgent(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { user_agent_id } = req.body;
    const { opponentAgentId } = req.params;

    if (!user_agent_id || !opponentAgentId) {
      return res.status(400).json({ error: "user_agent_id and opponentAgentId required" });
    }

    // Verify ownership
    const agent = await db("user_agents").where("id", user_agent_id).first();
    if (!agent || agent.user_id !== userId) {
      return res.status(403).json({ error: "Agent does not belong to this user" });
    }

    // Verify opponent exists
    const opponent = await db("user_agents").where("id", opponentAgentId).first();
    if (!opponent) return res.status(404).json({ error: "Opponent agent not found" });

    const result = await matchmakingService.joinQueue(user_agent_id, userId, parseInt(opponentAgentId));

    res.status(201).json({
      queue_entry_id: result.queueEntryId,
      opponent_agent_id: opponentAgentId,
      expires_at: result.expiresAt,
      message: "Challenge sent to opponent",
    });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to challenge agent");
    res.status(400).json({ error: err?.message || "Failed to challenge agent" });
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

/**
 * GET /api/arena/queue-stats
 * Debug endpoint: current queue occupancy.
 */
export async function getQueueStats(req, res) {
  try {
    const stats = await matchmakingService.getQueueStats();
    res.json(stats);
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to fetch queue stats");
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
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
