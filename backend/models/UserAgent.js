/**
 * UserAgent model — agents created or connected by users (for Tycoon and later other use cases).
 * See docs/USER_AGENT_CREATION_SPEC.md.
 * Optional API key (provider + api_key_encrypted) for "call via API key" without callback URL.
 */

import db from "../config/database.js";
import { encrypt, decrypt, isEncryptionAvailable } from "../lib/agentKeyEncryption.js";

const UserAgent = {
  async create(userId, data) {
    const {
      name,
      callback_url,
      config,
      status = "draft",
      hosted_url,
      erc8004_agent_id,
      chain_id,
      provider,
      api_key,
      use_tycoon_key,
    } = data;
    const useTycoonKey = !!use_tycoon_key;
    let apiKeyEncrypted = null;
    if (api_key && String(api_key).trim()) {
      if (!isEncryptionAvailable()) throw new Error("API key storage is not configured (set AGENT_API_KEY_SECRET)");
      apiKeyEncrypted = encrypt(String(api_key).trim());
      if (!apiKeyEncrypted) throw new Error("API key storage is not configured");
    }
    const [id] = await db("user_agents").insert({
      user_id: userId,
      name: name || "My Agent",
      callback_url: callback_url || null,
      config: config || null,
      status: status || "draft",
      hosted_url: hosted_url || null,
      erc8004_agent_id: erc8004_agent_id || null,
      chain_id: chain_id ?? 42220,
      provider: apiKeyEncrypted ? (provider && String(provider).trim()) || "anthropic" : null,
      api_key_encrypted: apiKeyEncrypted,
      use_tycoon_key: useTycoonKey,
    });
    const agent = await this.findById(id);
    if (useTycoonKey && agent && !agent.callback_url && !agent.hosted_url) {
      const base = process.env.BACKEND_PUBLIC_URL || "";
      if (base) {
        const url = `${base.replace(/\/$/, "")}/api/agent-registry/hosted/${id}/decision`;
        await db("user_agents").where({ id }).update({ hosted_url: url, updated_at: db.fn.now() });
        return this.findById(id);
      }
    }
    return agent;
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
    const allowed = [
      "name",
      "callback_url",
      "config",
      "status",
      "hosted_url",
      "erc8004_agent_id",
      "chain_id",
      "provider",
      "use_tycoon_key",
    ];
    const payload = {};
    for (const key of allowed) {
      if (data[key] !== undefined) payload[key] = data[key];
    }
    if (data.use_tycoon_key === true) {
      const base = process.env.BACKEND_PUBLIC_URL || "";
      if (base) payload.hosted_url = `${base.replace(/\/$/, "")}/api/agent-registry/hosted/${id}/decision`;
    }
    if (data.api_key !== undefined) {
      if (data.api_key === null || data.api_key === "") {
        payload.api_key_encrypted = null;
        payload.provider = null;
      } else {
        if (!isEncryptionAvailable()) throw new Error("API key storage is not configured (set AGENT_API_KEY_SECRET)");
        const enc = encrypt(String(data.api_key).trim());
        if (!enc) throw new Error("API key storage is not configured");
        payload.api_key_encrypted = enc;
        payload.provider = (data.provider && String(data.provider).trim()) || "anthropic";
      }
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

  /** Whether this agent can be used via saved API key (no callback URL needed). */
  hasSavedApiKey(agent) {
    return !!(agent && agent.has_api_key);
  },

  /** Whether this agent uses Tycoon's key (we run the AI; no URL or user key required). */
  usesTycoonKey(agent) {
    return !!(agent && agent.use_tycoon_key);
  },

  /**
   * Get decrypted API key for a user agent by id. Used by agent registry when slot is backed by saved key.
   * @param {number} id - user_agents.id
   * @returns {Promise<{ provider: string, apiKey: string }|null>}
   */
  async getDecryptedApiKey(id) {
    const row = await db("user_agents").where({ id }).first();
    if (!row || !row.api_key_encrypted) return null;
    const apiKey = decrypt(row.api_key_encrypted);
    if (!apiKey) return null;
    return { provider: row.provider || "anthropic", apiKey };
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
      provider: row.provider || null,
      has_api_key: !!(row.api_key_encrypted != null && row.api_key_encrypted !== ""),
      use_tycoon_key: !!(row.use_tycoon_key),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  },
};

export default UserAgent;
