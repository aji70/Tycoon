/**
 * Routes for user-created agents (My agents — create, list, update, delete).
 * All routes require authentication. See docs/USER_AGENT_CREATION_SPEC.md.
 */

import express from "express";
import { requireAuth } from "../middleware/auth.js";
import UserAgent from "../models/UserAgent.js";
import User from "../models/User.js";
import * as eloService from "../services/eloService.js";
import * as hostedAgentCreditsController from "../controllers/hostedAgentCreditsController.js";
import {
  listTournamentPermissions,
  upsertTournamentPermission,
  autoJoinTournament,
} from "../controllers/agentTournamentController.js";

const router = express.Router();

// ERC-8004 Identity Registry on Celo (mainnet + alfajores)
const ERC8004_IDENTITY_BY_CHAIN = {
  42220: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  44787: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
};

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
    const ownerUser = await User.findById(agent.user_id);
    const preferredOwner =
      ownerUser?.smart_wallet_address && String(ownerUser.smart_wallet_address).trim() && String(ownerUser.smart_wallet_address).trim() !== "0x0000000000000000000000000000000000000000"
        ? String(ownerUser.smart_wallet_address).trim()
        : ownerUser?.linked_wallet_address && String(ownerUser.linked_wallet_address).trim()
          ? String(ownerUser.linked_wallet_address).trim()
          : ownerUser?.address && String(ownerUser.address).trim()
            ? String(ownerUser.address).trim()
            : null;
    const chainId = agent.chain_id === 44787 ? 44787 : 42220;
    const identityRegistryAddress = ERC8004_IDENTITY_BY_CHAIN[chainId] || ERC8004_IDENTITY_BY_CHAIN[42220];
    const agentRegistry = `eip155:${chainId}:${identityRegistryAddress.toLowerCase()}`;
    const callbackUrl = UserAgent.getCallbackUrl(agent);
    const defaultPublicApp = (
      process.env.FRONTEND_URL ||
      process.env.PUBLIC_APP_URL ||
      "https://tycoonworld.xyz"
    ).replace(/\/$/, "");
    const webEndpoint = defaultPublicApp;
    const decisionEndpoint = callbackUrl;
    /** Same structural shape as frontend/public/tycoon-ai.json (EIP-8004 registration-v1). */
    const services = [{ name: "Web", endpoint: webEndpoint }];
    if (decisionEndpoint && decisionEndpoint !== webEndpoint) {
      services.push({ name: "Decision API", endpoint: decisionEndpoint, version: "v1" });
    }
    const defaultImage = `${defaultPublicApp}/footerLogo.svg`;
    const registration = {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: agent.name || "Tycoon Agent",
      description: `Monopoly-style on-chain game agent on Celo. ${agent.name || "This agent"} plays in Tycoon arena and classic matches. Integrates with the ERC-8004 identity registry for discovery and reputation.`,
      image: defaultImage,
      active: agent.status !== "draft" && agent.status !== "error",
      services,
      supportedTrust: ["reputation"],
      registrations:
        agent.erc8004_agent_id != null && String(agent.erc8004_agent_id) !== ""
          ? [{ agentId: Number(agent.erc8004_agent_id), agentRegistry }]
          : [],
      x402Support: false,
    };
    const primaryEndpoint = decisionEndpoint || webEndpoint;
    if (preferredOwner) {
      registration.owner = `eip155:${chainId}:${preferredOwner.toLowerCase()}`;
    }
    // Older / A2A clients that expect `endpoints` alongside `services`.
    registration.endpoints = [{ type: "a2a", url: primaryEndpoint }];
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
    const data = (list || []).map((a) => eloService.enrichAgentForArenaUi(a));
    res.json({ success: true, data });
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
    res.json({ success: true, data: eloService.enrichAgentForArenaUi(agent) });
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
    const hadErc8004 =
      existing.erc8004_agent_id != null && String(existing.erc8004_agent_id).trim() !== "";
    const body = req.body || {};
    const agent = await UserAgent.update(id, userId, body);
    let latest = agent;
    const hasErc8004 =
      agent.erc8004_agent_id != null && String(agent.erc8004_agent_id).trim() !== "";
    if (body.erc8004_agent_id !== undefined && hasErc8004 && !hadErc8004) {
      await eloService.awardActivityXpByAgentId(id, eloService.ACTIVITY_XP.ERC8004_LINKED, "erc8004_first_link");
      latest = await UserAgent.findByIdAndUser(id, userId);
    }
    res.json({ success: true, data: eloService.enrichAgentForArenaUi(latest) });
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
