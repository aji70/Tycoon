/**
 * UserAgent model — agents created or connected by users (for Tycoon and later other use cases).
 * See docs/USER_AGENT_CREATION_SPEC.md.
 */

import db from "../config/database.js";

const UserAgent = {
  async create(userId, data) {
    const { name, callback_url, config, status = "draft", hosted_url, erc8004_agent_id, chain_id } = data;
    const [id] = await db("user_agents").insert({
      user_id: userId,
      name: name || "My Agent",
      callback_url: callback_url || null,
      config: config || null,
      status: status || "draft",
      hosted_url: hosted_url || null,
      erc8004_agent_id: erc8004_agent_id || null,
      chain_id: chain_id ?? 42220,
    });
    return this.findById(id);
  },

  async findById(id) {
    const row = await db("user_agents").where({ id }).first();
    if (!row) return null;
    return this._normalize(row);
  },

  async findByIdAndUser(id, userId) {
    const row = await db("user_agents").where({ id, user_id: userId }).first();
    if (!row) return null;
    return this._normalize(row);
  },

  async findByUser(userId, { limit = 50, offset = 0 } = {}) {
    const rows = await db("user_agents")
      .where({ user_id: userId })
      .orderBy("updated_at", "desc")
      .limit(limit)
      .offset(offset);
    return rows.map((r) => this._normalize(r));
  },

  async update(id, userId, data) {
    const allowed = ["name", "callback_url", "config", "status", "hosted_url", "erc8004_agent_id", "chain_id"];
    const payload = {};
    for (const key of allowed) {
      if (data[key] !== undefined) payload[key] = data[key];
    }
    if (Object.keys(payload).length === 0) return this.findByIdAndUser(id, userId);
    await db("user_agents").where({ id, user_id: userId }).update({
      ...payload,
      updated_at: db.fn.now(),
    });
    return this.findByIdAndUser(id, userId);
  },

  async delete(id, userId) {
    const deleted = await db("user_agents").where({ id, user_id: userId }).del();
    return deleted > 0;
  },

  /** Resolve the URL to use when Tycoon calls this agent (callback_url or hosted_url). */
  getCallbackUrl(agent) {
    if (!agent) return null;
    const url = agent.hosted_url || agent.callback_url;
    return url && url.startsWith("http") ? url.replace(/\/$/, "") : null;
  },

  _normalize(row) {
    if (!row) return null;
    const config = row.config;
    return {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      callback_url: row.callback_url,
      config: typeof config === "string" ? (config ? JSON.parse(config) : null) : config,
      status: row.status,
      hosted_url: row.hosted_url,
      erc8004_agent_id: row.erc8004_agent_id,
      chain_id: row.chain_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  },
};

export default UserAgent;
