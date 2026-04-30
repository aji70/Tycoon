/**
 * Celo Agent Registry & Decision Adapter
 * Optional overlay: when an AI slot is backed by a registered agent, we ask it for decisions;
 * otherwise for AI games we use the internal LLM agent (assess state, think, decide); if that
 * is disabled or fails, existing built-in logic is used.
 * Assignments are persisted to agent_slot_assignments and rehydrated on startup.
 */

import db from "../config/database.js";
import logger from "../config/logger.js";
import Game from "../models/Game.js";
import GameSetting from "../models/GameSetting.js";
import UserAgent from "../models/UserAgent.js";
import internalAgent from "./internalAgent.js";
import * as hostedAgentUsage from "./hostedAgentUsage.js";
import * as hostedAgentCredits from "./hostedAgentCredits.js";

const AGENT_REQUEST_TIMEOUT_MS = Number(process.env.AGENT_DECISION_TIMEOUT_MS) || 8000;
const USE_INTERNAL_AGENT = process.env.USE_INTERNAL_AI_AGENT !== "false";
/** Sentinel: slot uses backend's internal agent (Claude), no external callback. */
const INTERNAL_AGENT_URL = "internal://tycoon";
// Set HOSTED_AGENT_CREDITS_PAUSED=true in .env to let the agent run without using or checking credits.
const HOSTED_AGENT_CREDITS_PAUSED = process.env.HOSTED_AGENT_CREDITS_PAUSED === "true";
const TABLE = "agent_slot_assignments";

// In-memory: slot -> { agentId, callbackUrl?, user_agent_id?, chainId?, name?, gameId?, slot? }
// Keys: "slot_2", "slot_3", ... or "game_123_slot_2" for game-specific binding
const slotRegistry = new Map();

// Serialize getAIDecision per (gameId, slot) to avoid races
const decisionLocks = new Map();

function registryKey(gameId, slot) {
  const gid = gameId != null ? Number(gameId) : 0;
  return gid ? `game_${gid}_slot_${slot}` : `slot_${slot}`;
}

function rowToEntry(row) {
  if (!row) return null;
  const gameId = row.game_id === 0 ? null : row.game_id;
  return {
    agentId: String(row.agent_id || row.user_agent_id || ""),
    callbackUrl: row.callback_url || null,
    user_agent_id: row.user_agent_id ? Number(row.user_agent_id) : null,
    chainId: Number(row.chain_id || 42220),
    name: row.name || `Agent ${row.slot}`,
    gameId,
    slot: row.slot,
    registeredAt: row.updated_at || row.created_at,
  };
}

/**
 * Load all assignments from DB into in-memory registry (call on startup).
 */
async function rehydrateFromDb() {
  try {
    const rows = await db(TABLE).select("*");
    slotRegistry.clear();
    for (const row of rows) {
      const key = registryKey(row.game_id === 0 ? null : row.game_id, row.slot);
      slotRegistry.set(key, rowToEntry(row));
    }
    console.log("[agentRegistry] Rehydrated", slotRegistry.size, "slot assignment(s) from DB");
  } catch (err) {
    console.warn("[agentRegistry] Rehydrate from DB failed:", err?.message);
  }
}

/**
 * Register an agent for a slot (global or per-game). Persists to DB and in-memory.
 * Slot 2-8 = AI seats; slot 1 (only when gameId is set) = "my agent plays for me" (user's seat).
 * Provide one of: callbackUrl (external agent), user_agent_id (saved API key), or useInternalAgent (backend's Claude).
 * @param {object} opts - { slot, agentId, callbackUrl?, user_agent_id?, useInternalAgent?, chainId?, name?, gameId? }
 */
async function registerAgent(opts) {
  const { slot, agentId, callbackUrl, user_agent_id, useInternalAgent, chainId = 42220, name, gameId } = opts;
  if (slot == null || slot < 1 || slot > 8) throw new Error("slot must be 1-8");
  if (gameId == null && slot === 1) throw new Error("slot 1 (user's agent) requires gameId");
  const hasCallback = callbackUrl && String(callbackUrl).startsWith("http");
  const hasUserAgentId = user_agent_id != null && Number(user_agent_id) > 0;
  const useInternal = !!useInternalAgent;
  if (!hasCallback && !hasUserAgentId && !useInternal) throw new Error("callbackUrl, user_agent_id, or useInternalAgent required");

  const gid = gameId != null ? Number(gameId) : 0;
  const key = registryKey(gameId, slot);
  const resolvedCallback = useInternal ? INTERNAL_AGENT_URL : (hasCallback ? String(callbackUrl).replace(/\/$/, "") : null);
  const payload = {
    game_id: gid,
    slot: Number(slot),
    user_agent_id: hasUserAgentId ? Number(user_agent_id) : null,
    callback_url: resolvedCallback,
    agent_id: String(agentId || ""),
    name: name || `Agent ${slot}`,
    chain_id: Number(chainId) || 42220,
    updated_at: db.fn.now(),
  };

  const existing = await db(TABLE).where({ game_id: gid, slot }).first();
  if (existing) {
    await db(TABLE).where({ id: existing.id }).update(payload);
  } else {
    await db(TABLE).insert({ ...payload, created_at: db.fn.now(), updated_at: db.fn.now() });
  }

  slotRegistry.set(key, {
    agentId: payload.agent_id,
    callbackUrl: resolvedCallback,
    user_agent_id: payload.user_agent_id,
    chainId: payload.chain_id,
    name: payload.name,
    gameId: gameId ? Number(gameId) : null,
    slot: Number(slot),
    registeredAt: new Date().toISOString(),
  });
  return { key, registered: true };
}

/**
 * Unregister agent for a slot (or game+slot). Removes from DB and in-memory.
 */
async function unregisterAgent(slot, gameId = null) {
  const gid = gameId != null ? Number(gameId) : 0;
  const key = registryKey(gameId, slot);
  await db(TABLE).where({ game_id: gid, slot: Number(slot) }).del();
  const deleted = slotRegistry.delete(key);
  return { key, deleted: !!deleted };
}

/**
 * Remove all agent assignments for a game (e.g. when game finishes).
 */
async function cleanupGame(gameId) {
  const id = Number(gameId);
  if (!id) return;
  const keys = [];
  for (const [key, entry] of slotRegistry) {
    if (entry.gameId === id) keys.push(key);
  }
  keys.forEach((k) => slotRegistry.delete(k));
  const deleted = await db(TABLE).where({ game_id: id }).del();
  if (deleted > 0 || keys.length > 0) {
    console.log("[agentRegistry] Cleaned up game", gameId, ":", keys.length, "in-memory,", deleted, "DB");
  }
  try {
    await db("arena_agent_challenge_locks").where({ game_id: id }).del();
  } catch (err) {
    console.warn("[agentRegistry] arena_agent_challenge_locks cleanup:", err?.message);
  }
}

/**
 * List all registered agents.
 */
function listAgents() {
  return Array.from(slotRegistry.entries()).map(([key, v]) => ({
    key,
    ...v,
  }));
}

/**
 * List agents registered for a specific game (for agent-bindings / "my agent" UI).
 */
function getAgentsForGame(gameId) {
  const id = Number(gameId);
  return listAgents().filter((a) => a.gameId === id);
}

/**
 * Resolve which agent (if any) backs this game+slot.
 * Prefer game-specific registration, then global slot registration.
 */
function getAgentForSlot(gameId, slot) {
  const gameKey = `game_${gameId}_slot_${slot}`;
  const slotKey = `slot_${slot}`;
  return slotRegistry.get(gameKey) || slotRegistry.get(slotKey) || null;
}

/**
 * Acquire a lock for (gameId, slot) so only one decision runs at a time per slot.
 */
async function withSlotLock(gameId, slot, fn) {
  const key = `decision_${Number(gameId)}_${Number(slot)}`;
  const prev = decisionLocks.get(key);
  let resolve;
  const myDone = new Promise((r) => { resolve = r; });
  decisionLocks.set(key, prev ? prev.then(() => myDone) : myDone);
  await (prev || Promise.resolve());
  try {
    return await fn();
  } finally {
    resolve();
    decisionLocks.delete(key);
  }
}

/**
 * Ask the agent for a decision. Returns decision object or null (use built-in logic).
 * Serialized per (gameId, slot) to avoid races.
 * Order: 1) registered external agent, 2) internal LLM agent for AI games, 3) null → built-in rules.
 * @param {number} gameId
 * @param {number} slot - AI slot 2-8
 * @param {string} decisionType - "property" | "trade" | "building" | "strategy"
 * @param {object} context - game context (myBalance, myProperties, opponents, landedProperty, tradeOffer, gameState, etc.)
 * @returns {Promise<object|null>} - { action, propertyId?, reasoning?, confidence? } or null
 */
async function getAIDecision(gameId, slot, decisionType, context) {
  return withSlotLock(gameId, slot, async () => getAIDecisionInner(gameId, slot, decisionType, context));
}

async function getAIDecisionInner(gameId, slot, decisionType, context) {
  const agent = getAgentForSlot(gameId, slot);
  logger.debug({
    gameId,
    slot,
    hasAgent: !!agent,
    agentUrl: agent?.callbackUrl,
    user_agent_id: agent?.user_agent_id,
  }, "getAIDecision");

  // User agent (saved key or Tycoon-hosted): use internal agent, optionally with user's skill
  if (agent?.user_agent_id) {
    try {
      const fullAgent = await UserAgent.findById(agent.user_agent_id);
      const skillPrompt = fullAgent?.config?.skill || fullAgent?.config?.system_prompt;
      const opts = skillPrompt ? { systemPrompt: String(skillPrompt) } : {};
      if (fullAgent?.use_tycoon_key) {
        const userId = fullAgent.user_id;
        if (!HOSTED_AGENT_CREDITS_PAUSED) {
          const hasPurchased = await hostedAgentCredits.hasCredits(userId);
          const hasFree = await hostedAgentUsage.isUnderCap(userId);
          if (hasPurchased) {
            const ok = await hostedAgentCredits.deductCredit(userId);
            if (!ok) {
              logger.debug({ userId, gameId, slot }, "Tycoon-hosted credits exhausted");
              return null;
            }
          } else if (hasFree) {
            await hostedAgentUsage.incrementUsage(userId);
          } else {
            logger.debug({ userId, gameId, slot }, "Tycoon-hosted no credits or daily cap");
            return null;
          }
        }
        const decision = await internalAgent.getDecision(
          Number(gameId),
          Number(slot),
          decisionType,
          context || {},
          opts
        );
        if (decision) {
          logger.info({ gameId, slot, decisionType, action: decision.action, source: "tycoon-hosted" }, "AI decision");
          return decision;
        }
      } else {
        const keyPayload = await UserAgent.getDecryptedApiKey(agent.user_agent_id);
        if (keyPayload?.apiKey) {
          const decision = await internalAgent.getDecisionWithKey(
            keyPayload.apiKey,
            Number(gameId),
            Number(slot),
            decisionType,
            context || {},
            opts
          );
          if (decision) {
            logger.info({ gameId, slot, decisionType, action: decision.action, source: "saved-key" }, "AI decision");
            return decision;
          }
        }
      }
    } catch (err) {
      logger.warn({ gameId, slot, err: err?.message }, "User agent decision failed");
    }
    return null;
  }

  // Backend internal agent (useInternalAgent) — uses ANTHROPIC_API_KEY, no external process
  if (agent?.callbackUrl === INTERNAL_AGENT_URL) {
    try {
      const decision = await internalAgent.getDecision(
        Number(gameId),
        Number(slot),
        decisionType,
        context || {}
      );
      if (decision) {
        logger.info({ gameId, slot, decisionType, action: decision.action, source: "internal-agent" }, "AI decision");
        return decision;
      }
    } catch (err) {
      logger.warn({ gameId, slot, err: err?.message }, "Internal agent decision failed");
    }
    return null;
  }

  // External callback URL
  if (agent?.callbackUrl) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const deadline = new Date(Date.now() + AGENT_REQUEST_TIMEOUT_MS).toISOString();
    const body = {
      requestId,
      gameId: Number(gameId),
      slot: Number(slot),
      decisionType,
      context: context || {},
      deadline,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AGENT_REQUEST_TIMEOUT_MS);

    try {
      logger.debug({ url: `${agent.callbackUrl}/decision`, gameId, slot }, "POSTing to external agent");
      const res = await fetch(`${agent.callbackUrl}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      console.log("[agentRegistry] Agent response status:", res.status);
      if (!res.ok) {
        console.warn("[agentRegistry] Agent returned non-OK status:", res.status);
        return null;
      }
      const data = await res.json().catch(() => null);
      console.log("[agentRegistry] Agent response data:", data);
      if (!data || data.requestId !== requestId) {
        console.warn("[agentRegistry] Invalid agent response (missing requestId or data)");
        return null;
      }
      return {
        action: data.action,
        propertyId: data.propertyId,
        reasoning: data.reasoning,
        confidence: data.confidence,
        counterOffer: data.counterOffer,
      };
    } catch (err) {
      clearTimeout(timeout);
      logger.warn({ gameId, slot, err: err?.message }, "External agent decision failed");
      return null;
    }
  }

  // No external agent: for AI games, route by ai_difficulty:
  // - easy: built-in rules only (return null so caller uses fallback)
  // - hard / boss: internal LLM agent (Claude)
  if (USE_INTERNAL_AGENT) {
    try {
      const game = await Game.findById(Number(gameId));
      const useInternal = game && (game.is_ai || decisionType === "tip");
      if (useInternal) {
        const gs = game?.is_ai ? await GameSetting.findByGameId(Number(gameId)) : null;
        let diff = (gs?.ai_difficulty || "boss").toLowerCase();
        if (gs?.ai_difficulty_mode === "random" && gs?.ai_difficulty_per_slot && typeof gs.ai_difficulty_per_slot === "object") {
          const slotDiff = gs.ai_difficulty_per_slot[String(slot)];
          if (["easy", "hard", "boss"].includes(String(slotDiff).toLowerCase())) {
            diff = String(slotDiff).toLowerCase();
          }
        }
        if (decisionType !== "tip" && game.is_ai && diff === "easy") {
          logger.debug({ gameId, slot, decisionType, ai_difficulty: diff }, "Easy: using built-in rules");
          return null;
        }
        for (let attempt = 1; attempt <= 2; attempt++) {
          const decision = await internalAgent.getDecision(
            Number(gameId),
            Number(slot),
            decisionType,
            context || {}
          );
          if (decision) {
            logger.info(
              { gameId, slot, decisionType, action: decision.action, source: "internal", attempt, difficulty: diff },
              "AI decision (Claude)"
            );
            return decision;
          }
          if (attempt === 1) {
            logger.debug({ gameId, slot, decisionType, attempt }, "Internal agent returned null, retrying");
          }
        }
      }
    } catch (err) {
      logger.warn({ gameId, slot, decisionType, err: err?.message }, "Internal agent fallback failed");
    }
  }

  return null;
}

/**
 * Auto-register slots to use backend's internal agent (Claude) on startup.
 * Set TYCOON_INTERNAL_AGENT_SLOTS=2,3,4,5,6,7,8 to have those slots always use backend's ANTHROPIC_API_KEY.
 * No separate tycoon-celo-agent process needed.
 */
async function autoRegisterInternalAgentSlots() {
  const raw = process.env.TYCOON_INTERNAL_AGENT_SLOTS;
  if (!raw || typeof raw !== "string" || !raw.trim()) return;
  const slots = raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 2 && n <= 8);
  if (slots.length === 0) return;
  const agentId = process.env.ERC8004_AGENT_ID || "tycoon-celo-agent";
  for (const slot of slots) {
    try {
      await registerAgent({
        slot,
        agentId: `${agentId}-slot-${slot}`,
        useInternalAgent: true,
        name: `Tycoon Celo Agent (slot ${slot})`,
      });
      logger.info({ slot }, "Auto-registered internal agent slot");
    } catch (err) {
      logger.warn({ slot, err: err?.message }, "Auto-register internal agent slot failed");
    }
  }
}

export default {
  registerAgent,
  unregisterAgent,
  listAgents,
  getAgentsForGame,
  getAgentForSlot,
  getAIDecision,
  rehydrateFromDb,
  autoRegisterInternalAgentSlots,
  cleanupGame,
};
