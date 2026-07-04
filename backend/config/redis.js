import { createClient } from "redis";
import logger from "./logger.js";

/**
 * Resilient Redis wrapper.
 *
 * - Auto-reconnects with capped exponential backoff (never permanently disables itself).
 * - Every command is guarded: when Redis is down, reads return null and writes are no-ops,
 *   so callers can always treat cache failures as cache misses.
 * - `set` applies a default TTL so ad-hoc cache keys can never grow Redis unbounded.
 *   Pass an explicit ttl (seconds) or 0 for no expiry when a key is meant to persist.
 */

const DEFAULT_TTL_SECONDS = Number(process.env.REDIS_DEFAULT_TTL_SECONDS) || 6 * 60 * 60; // 6h

const disabled = process.env.SKIP_REDIS === "true";
let client = null;

if (disabled) {
  logger.info("Redis skipped (SKIP_REDIS=true) – cache disabled");
} else {
  client = createClient({
    url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    socket: {
      tls: process.env.REDIS_TLS === "true",
      connectTimeout: 5000,
      reconnectStrategy: (retries) => Math.min(1000 * 2 ** Math.min(retries, 5), 30000),
    },
    // Keep Railway/managed Redis connections from idling out.
    pingInterval: 30000,
  });

  let lastErrorAt = 0;
  client.on("error", (err) => {
    // Throttle error logs: the client emits on every failed reconnect attempt.
    const now = Date.now();
    if (now - lastErrorAt > 60000) {
      lastErrorAt = now;
      logger.warn({ err: err?.message }, "Redis error (cache degraded, will keep retrying)");
    }
  });
  client.on("ready", () => logger.info("Redis connected"));
  client.on("reconnecting", () => {});

  client.connect().catch((err) => {
    logger.warn({ err: err?.message }, "Initial Redis connect failed – client will keep retrying");
  });
}

function ready() {
  return !disabled && client?.isReady === true;
}

const redis = {
  /** True when the cache is usable right now. */
  get isReady() {
    return ready();
  },

  async get(key) {
    if (!ready()) return null;
    try {
      return await client.get(key);
    } catch {
      return null;
    }
  },

  /**
   * Set a key. ttlSeconds defaults to REDIS_DEFAULT_TTL_SECONDS (6h); pass 0 to persist.
   */
  async set(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
    if (!ready()) return;
    try {
      if (ttlSeconds > 0) {
        await client.set(key, value, { EX: ttlSeconds });
      } else {
        await client.set(key, value);
      }
    } catch {
      /* cache write failures are non-fatal */
    }
  },

  /** Set key with TTL (seconds). Use for cache entries. */
  async setex(key, seconds, value) {
    if (!ready()) return;
    try {
      await client.setEx(key, seconds, value);
    } catch {
      /* non-fatal */
    }
  },

  async del(...keys) {
    if (!ready() || keys.length === 0) return;
    try {
      await client.del(keys.flat());
    } catch {
      /* non-fatal */
    }
  },

  /** JSON convenience: parsed value or null on miss/parse error. */
  async getJSON(key) {
    const raw = await this.get(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /** JSON convenience: stringify + set with TTL (seconds). */
  async setJSON(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
    try {
      await this.set(key, JSON.stringify(value), ttlSeconds);
    } catch {
      /* non-fatal */
    }
  },

  /** Graceful shutdown. */
  async quit() {
    if (disabled || !client) return;
    try {
      await client.quit();
    } catch {
      client.destroy();
    }
  },
};

export default redis;
