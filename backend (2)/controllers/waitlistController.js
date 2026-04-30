import redis from "../config/redis.js";
import Waitlist from "../models/Waitlist.js";

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
      const cacheKey = `waitlist:${id}`;
      const _cached = await redis.get(cacheKey);
      const cached = _cached ? JSON.parse(_cached) : null;
      if (cached) {
        return res.json({ success: true, message: "successful", data: cached });
      }
      const waitlist = await Waitlist.findById(req.params.id);
      if (!waitlist)
        return res.status(404).json({ error: "Waitlist not found" });
      const add_to_cache = await redis.set(cacheKey, JSON.stringify(waitlist));
      res.json({ success: true, message: "successful", data: waitlist });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const cacheKey = "properties";
      const _cached = await redis.get(cacheKey);
      const cached = _cached ? JSON.parse(_cached) : null;
      if (cached) {
        return res.json({ success: true, message: "successful", data: cached });
      }
      const { limit, offset } = req.query;
      const properties = await Waitlist.findAll({
        limit: Number.parseInt(limit) || 100,
        offset: Number.parseInt(offset) || 0,
      });
      const add_to_cache = await redis.set(cacheKey, JSON.stringify(properties));
      res.json({ success: true, message: "successful", data: properties });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async update(req, res) {
    try {
      const waitlist = await Waitlist.update(req.params.id, req.body);
      res.json({ success: true, message: "successful", data: waitlist });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async remove(req, res) {
    try {
      await Waitlist.delete(req.params.id);
      res.json({ success: true, message: "successful", data: null });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};

export default waitlistController;
