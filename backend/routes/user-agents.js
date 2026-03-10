/**
 * Routes for user-created agents (My agents — create, list, update, delete).
 * All routes require authentication. See docs/USER_AGENT_CREATION_SPEC.md.
 */

import express from "express";
import { requireAuth } from "../middleware/auth.js";
import UserAgent from "../models/UserAgent.js";

const router = express.Router();

router.use(requireAuth);

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

/** Create agent (body: name, callback_url, provider?, api_key? or config for future "create & deploy") */
router.post("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, callback_url, config, erc8004_agent_id, chain_id, provider, api_key } = req.body || {};
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
