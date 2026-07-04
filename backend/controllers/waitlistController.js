import redis from "../config/redis.js";
import Waitlist from "../models/Waitlist.js";

const LIST_CACHE_KEY = "waitlists:all";
const ITEM_CACHE_PREFIX = "waitlist:";
const CACHE_TTL_SECONDS = 300;

async function invalidateWaitlistCaches(id) {
  await redis.del(LIST_CACHE_KEY, ...(id != null ? [ITEM_CACHE_PREFIX + id] : []));
}

/**
 * Waitlist Controller
 *
 * Handles requests related to waitlist
 */
const waitlistController = {
  // -------------------------
  // 🔹 CRUD
  // -------------------------

  async create(req, res) {
    try {
      const waitlist = await Waitlist.create(req.body);
      await invalidateWaitlistCaches();
      res
        .status(201)
        .json({ success: true, message: "successful", data: waitlist });
    } catch (error) {
      console.error("Error creating waitlist:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async findById(req, res) {
    try {
      const { id } = req.params;
      const cacheKey = ITEM_CACHE_PREFIX + id;
      const cached = await redis.getJSON(cacheKey);
      if (cached) {
        return res.json({ success: true, message: "successful", data: cached });
      }
      const waitlist = await Waitlist.findById(id);
      if (!waitlist)
        return res.status(404).json({ error: "Waitlist not found" });
      await redis.setJSON(cacheKey, waitlist, CACHE_TTL_SECONDS);
      res.json({ success: true, message: "successful", data: waitlist });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const limit = Number.parseInt(req.query.limit) || 100;
      const offset = Number.parseInt(req.query.offset) || 0;
      // Only the default page is cached; paginated requests go to the DB.
      const useCache = limit === 100 && offset === 0;
      if (useCache) {
        const cached = await redis.getJSON(LIST_CACHE_KEY);
        if (cached) {
          return res.json({ success: true, message: "successful", data: cached });
        }
      }
      const waitlists = await Waitlist.findAll({ limit, offset });
      if (useCache) await redis.setJSON(LIST_CACHE_KEY, waitlists, CACHE_TTL_SECONDS);
      res.json({ success: true, message: "successful", data: waitlists });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async update(req, res) {
    try {
      const waitlist = await Waitlist.update(req.params.id, req.body);
      await invalidateWaitlistCaches(req.params.id);
      res.json({ success: true, message: "successful", data: waitlist });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async remove(req, res) {
    try {
      await Waitlist.delete(req.params.id);
      await invalidateWaitlistCaches(req.params.id);
      res.json({ success: true, message: "successful", data: null });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};

export default waitlistController;
