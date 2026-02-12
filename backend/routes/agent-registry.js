/**
 * Routes for Celo agent registry and optional agent decision endpoint.
 * See CELO_AGENT_INTEGRATION.md.
 */

import express from "express";
import agentRegistry from "../services/agentRegistry.js";

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
router.post("/register", (req, res) => {
  try {
    const result = agentRegistry.registerAgent(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/** Unregister (query: slot, gameId?) */
router.post("/unregister", (req, res) => {
  try {
    const { slot, gameId } = req.body || req.query;
    const result = agentRegistry.unregisterAgent(Number(slot), gameId ? Number(gameId) : null);
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
    if (decision) {
      return res.json({ success: true, data: decision, useBuiltIn: false });
    }
    res.json({ success: true, data: null, useBuiltIn: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
