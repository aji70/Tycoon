import redis from "../config/redis.js";
import Chance from "../models/Chance.js";

const LIST_CACHE_KEY = "chances:all";
const ITEM_CACHE_PREFIX = "chance:";
/** Card decks are static seed data; long TTL + invalidation on admin writes. */
const CACHE_TTL_SECONDS = 24 * 60 * 60;

async function invalidateChanceCaches(id) {
  await redis.del(LIST_CACHE_KEY, ...(id != null ? [ITEM_CACHE_PREFIX + id] : []));
}

/**
 * Chance Controller
 *
 * Handles requests related to chances.
 */
const chanceController = {
  // -------------------------
  // 🔹 CRUD
  // -------------------------

  async create(req, res) {
    try {
      const chance = await Chance.create(req.body);
      await invalidateChanceCaches();
      res.status(201).json(chance);
    } catch (error) {
      console.error("Error creating chance:", error);
      res.status(400).json({ error: error.message });
    }
  },

  async findById(req, res) {
    try {
      const cacheKey = ITEM_CACHE_PREFIX + req.params.id;
      const cached = await redis.getJSON(cacheKey);
      if (cached) return res.json(cached);
      const chance = await Chance.findById(req.params.id);
      if (!chance) return res.status(404).json({ error: "Chance not found" });
      await redis.setJSON(cacheKey, chance, CACHE_TTL_SECONDS);
      res.json(chance);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const limit = Number.parseInt(req.query.limit) || 100;
      const offset = Number.parseInt(req.query.offset) || 0;
      const useCache = limit === 100 && offset === 0;
      if (useCache) {
        const cached = await redis.getJSON(LIST_CACHE_KEY);
        if (cached) return res.json(cached);
      }
      const chances = await Chance.findAll({ limit, offset });
      if (useCache) await redis.setJSON(LIST_CACHE_KEY, chances, CACHE_TTL_SECONDS);
      res.json(chances);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async update(req, res) {
    try {
      const chance = await Chance.update(req.params.id, req.body);
      await invalidateChanceCaches(req.params.id);
      res.json(chance);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async remove(req, res) {
    try {
      await Chance.delete(req.params.id);
      await invalidateChanceCaches(req.params.id);
      res.json({ message: "Chance deleted" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

export default chanceController;
