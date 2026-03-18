/**
 * Routes for Celo agent registry and optional agent decision endpoint.
 * See CELO_AGENT_INTEGRATION.md.
 */

import express from "express";
import agentRegistry from "../services/agentRegistry.js";
import internalAgent from "../services/internalAgent.js";
import UserAgent from "../models/UserAgent.js";
import * as hostedAgentUsage from "../services/hostedAgentUsage.js";
import * as hostedAgentCredits from "../services/hostedAgentCredits.js";
import GamePlayer from "../models/GamePlayer.js";
import { requireAuth } from "../middleware/auth.js";
import { submitErc8004Feedback } from "../services/erc8004Feedback.js";

const router = express.Router();

/** List all registered agents */
router.get("/", (req, res) => {
  try {
    const list = agentRegistry.listAgents();
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Register an agent for an AI slot (body: slot, agentId, callbackUrl, chainId?, name?, gameId?) */
router.post("/register", async (req, res) => {
  try {
    const result = await agentRegistry.registerAgent(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/** Unregister (query: slot, gameId?) */
router.post("/unregister", async (req, res) => {
  try {
    const { slot, gameId } = req.body || req.query;
    const result = await agentRegistry.unregisterAgent(Number(slot), gameId ? Number(gameId) : null);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * Get AI decision from agent if registered; otherwise returns { useBuiltIn: true }.
 * Body: { gameId, slot, decisionType, context }
 * Used by frontend or backend to "try agent first, then use built-in logic".
 */
router.post("/decision", async (req, res) => {
  try {
    const { gameId, slot, decisionType, context } = req.body || {};
    console.log("[agent-registry] Decision request:", { gameId, slot, decisionType });
    if (!gameId || !slot || !decisionType) {
      return res.status(400).json({
        success: false,
        message: "gameId, slot, and decisionType required",
      });
    }
    const decision = await agentRegistry.getAIDecision(
      Number(gameId),
      Number(slot),
      decisionType,
      context
    );
    console.log("[agent-registry] Decision result:", decision ? "from agent" : "useBuiltIn");
    if (decision) {
      return res.json({ success: true, data: decision, useBuiltIn: false });
    }
    // For tips, return a sensible default tip (buy by default — properties win games)
    if (decisionType === "tip") {
      return res.json({
        success: true,
        data: { action: "buy", reasoning: "Buy it — owning properties is how you win!", confidence: 50 },
        useBuiltIn: true,
      });
    }
    res.json({ success: true, data: null, useBuiltIn: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Option B: Get decision using the user's own API key (no storage). Key is used only for this request.
 * Body: { gameId, decisionType, context, provider: "anthropic", apiKey }
 * Requires auth; verifies user is in the game.
 */
router.post("/decision-with-key", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const { gameId, decisionType, context, provider, apiKey } = req.body || {};
    if (!gameId || !decisionType) {
      return res.status(400).json({ success: false, message: "gameId and decisionType required" });
    }
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return res.status(400).json({ success: false, message: "apiKey required" });
    }
    const gid = Number(gameId);
    const player = await GamePlayer.findByUserIdAndGameId(userId, gid);
    if (!player) {
      return res.status(403).json({ success: false, message: "You are not in this game" });
    }
    if (provider !== "anthropic") {
      return res.status(400).json({ success: false, message: "Only provider 'anthropic' is supported" });
    }
    const decision = await internalAgent.getDecisionWithKey(
      apiKey.trim(),
      gid,
      1,
      decisionType,
      context || {}
    );
    if (!decision) {
      return res.status(502).json({ success: false, message: "Decision request failed (check your API key)" });
    }
    return res.json({ success: true, data: decision });
  } catch (err) {
    console.error("[agent-registry] decision-with-key error:", err?.message);
    return res.status(500).json({ success: false, message: err?.message || "Decision failed" });
  }
});

/**
 * POST: Submit ERC-8004 reputation feedback for an AI agent action (buy, build, trade).
 * Fire-and-forget from the frontend after each successful AI action.
 * Body: { gameId, slot, actionType }
 * actionType: "buyProperty" | "buildHouse" | "buildHotel" | "proposeTrade" | "acceptTrade"
 * Resolves agentId from the registered agent for this slot (falls back to ERC8004_AGENT_ID).
 */
router.post("/action-feedback", async (req, res) => {
  // Always respond immediately — this is fire-and-forget
  res.json({ success: true });

  try {
    const { gameId, slot, actionType } = req.body || {};
    if (!gameId || !actionType) return;

    const SCORES = {
      buyProperty: 5,
      buildHotel: 15,
      proposeTrade: 5,
      acceptTrade: 5,
    };
    const score = SCORES[actionType] ?? 5;

    // Resolve ERC-8004 agent ID: prefer the registered agent's ID, fall back to env var
    let erc8004AgentId = process.env.ERC8004_AGENT_ID;
    if (gameId && slot) {
      try {
        const registered = agentRegistry.getAgentForSlot(Number(gameId), Number(slot));
        if (registered?.user_agent_id) {
          const userAgent = await UserAgent.findById(registered.user_agent_id);
          if (userAgent?.erc8004_agent_id) {
            erc8004AgentId = String(userAgent.erc8004_agent_id);
          }
        }
        if (!erc8004AgentId || String(erc8004AgentId).trim() === "") return;
        await submitErc8004Feedback(erc8004AgentId, score, "agentAction");
      } catch (err) {
        console.error("[agent-registry] action-feedback error:", err?.message);
      }
    }
  } catch (_) { /* best-effort */ }
});

/**
 * Tycoon-hosted agent decision endpoint.
 * Called when a user's agent has hosted_url pointing here (use_tycoon_key or template).
 * Body: { requestId, gameId, slot, decisionType, context, deadline } (same as external agent).
 */
router.post("/hosted/:agentId/decision", async (req, res) => {
  try {
    const agentId = Number(req.params.agentId);
    if (!Number.isInteger(agentId)) {
      return res.status(400).json({ success: false, message: "Invalid agent id" });
    }
    const { requestId, gameId, slot, decisionType, context } = req.body || {};
    if (!requestId || !gameId || !slot || !decisionType) {
      return res.status(400).json({ success: false, message: "requestId, gameId, slot, decisionType required" });
    }
    const agent = await UserAgent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    const skillPrompt = agent.config?.skill || agent.config?.system_prompt;
    const opts = skillPrompt ? { systemPrompt: String(skillPrompt) } : {};
    let decision;
    const creditsPaused = process.env.HOSTED_AGENT_CREDITS_PAUSED === "true";
    if (agent.use_tycoon_key) {
      const userId = agent.user_id;
      if (!creditsPaused) {
        const hasPurchased = await hostedAgentCredits.hasCredits(userId);
        const hasFree = await hostedAgentUsage.isUnderCap(userId);
        if (hasPurchased) {
          const ok = await hostedAgentCredits.deductCredit(userId);
          if (!ok) return res.status(429).json({ success: false, message: "No credits. Buy more or use My API key." });
        } else if (hasFree) {
          await hostedAgentUsage.incrementUsage(userId);
        } else {
          return res.status(429).json({ success: false, message: "Daily hosted limit reached. Buy credits or use My API key." });
        }
      }
      decision = await internalAgent.getDecision(Number(gameId), Number(slot), decisionType, context || {}, opts);
    } else if (agent.has_api_key) {
      const keyPayload = await UserAgent.getDecryptedApiKey(agentId);
      if (keyPayload?.apiKey) {
        decision = await internalAgent.getDecisionWithKey(
          keyPayload.apiKey,
          Number(gameId),
          Number(slot),
          decisionType,
          context || {},
          opts
        );
      }
    }
    if (!decision) {
      return res.status(502).json({ success: false, message: "Decision failed" });
    }
    return res.json({ requestId, ...decision });
  } catch (err) {
    console.error("[agent-registry] hosted decision error:", err?.message);
    return res.status(500).json({ success: false, message: err?.message || "Decision failed" });
  }
});

export default router;
