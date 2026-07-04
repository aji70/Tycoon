import redis from "../config/redis.js";
import CommunityChest from "../models/CommunityChest.js";

const LIST_CACHE_KEY = "community_chests:all";
const ITEM_CACHE_PREFIX = "community_chest:";
/** Card decks are static seed data; long TTL + invalidation on admin writes. */
const CACHE_TTL_SECONDS = 24 * 60 * 60;

async function invalidateCommunityChestCaches(id) {
  await redis.del(LIST_CACHE_KEY, ...(id != null ? [ITEM_CACHE_PREFIX + id] : []));
}

/**
 * CommunityChest Controller
 *
 * Handles requests related to community chests
 */
const communityChestController = {
  // -------------------------
  // 🔹 CRUD
  // -------------------------

  async create(req, res) {
    try {
      const communityChest = await CommunityChest.create(req.body);
      await invalidateCommunityChestCaches();
      res.status(201).json(communityChest);
    } catch (error) {
      console.error("Error creating community chest:", error);
      res.status(400).json({ error: error.message });
    }
  },

  async findById(req, res) {
    try {
      const cacheKey = ITEM_CACHE_PREFIX + req.params.id;
      const cached = await redis.getJSON(cacheKey);
      if (cached) return res.json(cached);
      const communityChest = await CommunityChest.findById(req.params.id);
      if (!communityChest)
        return res.status(404).json({ error: "Community chest not found" });
      await redis.setJSON(cacheKey, communityChest, CACHE_TTL_SECONDS);
      res.json(communityChest);
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
      const communityChests = await CommunityChest.findAll({ limit, offset });
      if (useCache) await redis.setJSON(LIST_CACHE_KEY, communityChests, CACHE_TTL_SECONDS);
      res.json(communityChests);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async update(req, res) {
    try {
      const communityChest = await CommunityChest.update(
        req.params.id,
        req.body
      );
      await invalidateCommunityChestCaches(req.params.id);
      res.json(communityChest);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async remove(req, res) {
    try {
      await CommunityChest.delete(req.params.id);
      await invalidateCommunityChestCaches(req.params.id);
      res.json({ message: "Community chest deleted" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

export default communityChestController;
