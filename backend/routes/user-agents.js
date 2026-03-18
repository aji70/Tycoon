/**
 * Routes for user-created agents (My agents — create, list, update, delete).
 * All routes require authentication. See docs/USER_AGENT_CREATION_SPEC.md.
 */

import express from "express";
import { requireAuth } from "../middleware/auth.js";
import UserAgent from "../models/UserAgent.js";
import * as hostedAgentCreditsController from "../controllers/hostedAgentCreditsController.js";
import {
  listTournamentPermissions,
  upsertTournamentPermission,
  autoJoinTournament,
} from "../controllers/agentTournamentController.js";

const router = express.Router();

// ERC-8004 Identity Registry on Celo (mainnet); Alfajores may use a different address
const ERC8004_IDENTITY_MAINNET = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

/**
 * GET /api/agents/:id/erc8004-registration
 * Public: returns the ERC-8004 agent registration file (JSON) for the given agent.
 * Used as agentURI when calling the Identity Registry register(agentURI).
 * See https://eips.ethereum.org/EIPS/eip-8004
 */
router.get("/:id/erc8004-registration", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: "Invalid agent id" });
    }
    const agent = await UserAgent.findById(id);
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    const chainId = agent.chain_id === 44787 ? 44787 : 42220;
    const agentRegistry = `eip155:${chainId}:${ERC8004_IDENTITY_MAINNET.toLowerCase()}`;
    const callbackUrl = UserAgent.getCallbackUrl(agent);
    const registration = {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: agent.name || "Tycoon Agent",
      description: agent.name ? `Tycoon agent: ${agent.name}` : "AI agent for Tycoon (Monopoly-style game).",
      image: "",
      services: callbackUrl
        ? [{ name: "web", endpoint: callbackUrl }]
        : [{ name: "web", endpoint: "https://tycoon.game" }],
      supportedTrust: ["reputation"],
      registrations:
        agent.erc8004_agent_id != null && String(agent.erc8004_agent_id) !== ""
          ? [{ agentId: Number(agent.erc8004_agent_id), agentRegistry }]
          : [],
    };
    res.set("Content-Type", "application/json");
    res.set("Access-Control-Allow-Origin", "*");
    res.send(JSON.stringify(registration, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, message: err?.message || "Failed to load registration" });
  }
});

router.use(requireAuth);

/** Get current user's hosted agent credits (balance + daily free tier). */
router.get("/hosted-credits", hostedAgentCreditsController.getCredits);

/** Purchase credits with USDC (verify tx_hash) */
router.post("/hosted-credits/purchase/usdc", hostedAgentCreditsController.purchaseUsdc);

/** Initialize NGN purchase via Flutterwave */
router.post("/hosted-credits/purchase/ngn/initialize", hostedAgentCreditsController.purchaseNgnInitialize);

/** Verify NGN purchase status (for redirect page) */
router.get("/hosted-credits/purchase/ngn/verify", hostedAgentCreditsController.purchaseNgnVerify);

/** List current user's agents */
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const list = await UserAgent.findByUser(userId);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** List tournament permissions for current user's agents */
router.get("/tournament-permissions", listTournamentPermissions);

/** Enable/disable tournament spending permission for an agent (PIN required to enable) */
router.post("/:agentId/tournament-permissions", upsertTournamentPermission);

/** Manually trigger auto-join for one tournament (uses smart wallet if needed) */
router.post("/:agentId/auto-join-tournament", autoJoinTournament);

/** Create agent (body: name, callback_url?, provider?, api_key?, use_tycoon_key?) */
router.post("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, callback_url, config, erc8004_agent_id, chain_id, provider, api_key, use_tycoon_key } = req.body || {};
    if (!name || String(name).trim() === "") {
      return res.status(400).json({ success: false, message: "name is required" });
    }
    const agent = await UserAgent.create(userId, {
      name: name.trim(),
      callback_url: callback_url?.trim() || null,
      config: config || null,
      erc8004_agent_id: erc8004_agent_id || null,
      chain_id: chain_id ?? 42220,
      provider: provider?.trim() || null,
      api_key: api_key != null ? api_key : undefined,
      use_tycoon_key: !!use_tycoon_key,
    });
    res.status(201).json({ success: true, data: agent });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/** Get one agent (must belong to current user) */
router.get("/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: "Invalid agent id" });
    }
    const agent = await UserAgent.findByIdAndUser(id, userId);
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    res.json({ success: true, data: agent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Update agent */
router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: "Invalid agent id" });
    }
    const existing = await UserAgent.findByIdAndUser(id, userId);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    const agent = await UserAgent.update(id, userId, req.body || {});
    res.json({ success: true, data: agent });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/** Delete agent */
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: "Invalid agent id" });
    }
    const deleted = await UserAgent.delete(id, userId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    res.json({ success: true, deleted: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
