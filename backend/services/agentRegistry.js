/**
 * Celo Agent Registry & Decision Adapter
 * Optional overlay: when an AI slot is backed by a registered agent, we ask it for decisions;
 * otherwise for AI games we use the internal LLM agent (assess state, think, decide); if that
 * is disabled or fails, existing built-in logic is used.
 */

import Game from "../models/Game.js";
import internalAgent from "./internalAgent.js";

const AGENT_REQUEST_TIMEOUT_MS = Number(process.env.AGENT_DECISION_TIMEOUT_MS) || 8000;
const USE_INTERNAL_AGENT = process.env.USE_INTERNAL_AI_AGENT !== "false";

// In-memory: slot -> { agentId, callbackUrl, chainId?, name? }
// Keys: "slot_2", "slot_3", ... or "game_123_slot_2" for game-specific binding
const slotRegistry = new Map();

/**
 * Register an agent for an AI slot (global or per-game).
 * @param {object} opts - { slot: number (2-8), agentId: string, callbackUrl: string, chainId?: number, name?: string, gameId?: number }
 */
function registerAgent(opts) {
  const { slot, agentId, callbackUrl, chainId = 42220, name, gameId } = opts;
  if (!slot || slot < 2 || slot > 8) throw new Error("slot must be 2-8");
  if (!callbackUrl?.startsWith("http")) throw new Error("callbackUrl must be HTTP(S)");
  const key = gameId ? `game_${gameId}_slot_${slot}` : `slot_${slot}`;
  slotRegistry.set(key, {
    agentId: String(agentId),
    callbackUrl: callbackUrl.replace(/\/$/, ""),
    chainId: Number(chainId),
    name: name || `Agent ${slot}`,
    gameId: gameId ? Number(gameId) : null,
    slot,
    registeredAt: new Date().toISOString(),
  });
  return { key, registered: true };
}

/**
 * Unregister agent for a slot (or game+slot).
 */
function unregisterAgent(slot, gameId = null) {
  const key = gameId ? `game_${gameId}_slot_${slot}` : `slot_${slot}`;
  const deleted = slotRegistry.delete(key);
  return { key, deleted: !!deleted };
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
 * Resolve which agent (if any) backs this game+slot.
 * Prefer game-specific registration, then global slot registration.
 */
function getAgentForSlot(gameId, slot) {
  const gameKey = `game_${gameId}_slot_${slot}`;
  const slotKey = `slot_${slot}`;
  return slotRegistry.get(gameKey) || slotRegistry.get(slotKey) || null;
}

/**
 * Ask the agent for a decision. Returns decision object or null (use built-in logic).
 * Order: 1) registered external agent, 2) internal LLM agent for AI games, 3) null → built-in rules.
 * @param {number} gameId
 * @param {number} slot - AI slot 2-8
 * @param {string} decisionType - "property" | "trade" | "building" | "strategy"
 * @param {object} context - game context (myBalance, myProperties, opponents, landedProperty, tradeOffer, gameState, etc.)
 * @returns {Promise<object|null>} - { action, propertyId?, reasoning?, confidence? } or null
 */
async function getAIDecision(gameId, slot, decisionType, context) {
  const agent = getAgentForSlot(gameId, slot);
  console.log("[agentRegistry] getAIDecision:", { gameId, slot, hasAgent: !!agent, agentUrl: agent?.callbackUrl });

  if (agent) {

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
    console.log("[agentRegistry] POSTing to agent:", `${agent.callbackUrl}/decision`);
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
    console.error("[agentRegistry] Agent decision request failed:", err.message);
    return null;
  }
  }

  // No external agent: use internal LLM agent for AI games (one logical agent per game), or for "tip" in any game
  if (USE_INTERNAL_AGENT) {
    try {
      const game = await Game.findById(Number(gameId));
      const useInternal = game && (game.is_ai || decisionType === "tip");
      if (useInternal) {
        const decision = await internalAgent.getDecision(
          Number(gameId),
          Number(slot),
          decisionType,
          context || {}
        );
        if (decision) {
          console.log(
            "[agentRegistry] CLAUDE INTERNAL AGENT | gameId=%s slot=%s type=%s action=%s reasoning=%s",
            gameId,
            slot,
            decisionType,
            decision.action,
            (decision.reasoning || "").slice(0, 80)
          );
          return decision;
        }
      }
    } catch (err) {
      console.warn("[agentRegistry] Internal agent fallback failed:", err.message);
    }
  }

  return null;
}

export default {
  registerAgent,
  unregisterAgent,
  listAgents,
  getAgentForSlot,
  getAIDecision,
};
