import redis from "../config/redis.js";
import Property from "../models/Property.js";
import {
  resolveBoardIdForGame,
  mergeCanonicalPropertiesWithVariant,
  invalidatePropertyListCaches,
} from "../utils/boardVariant.js";

const ITEM_CACHE_PREFIX = "property:";
/** Board properties are effectively static; long TTL + explicit invalidation on writes. */
const CACHE_TTL_SECONDS = 24 * 60 * 60;

async function invalidatePropertyCaches(id) {
  await invalidatePropertyListCaches(redis);
  if (id != null) await redis.del(ITEM_CACHE_PREFIX + id);
}

/**
 * Property Controller
 *
 * Handles requests related to property
 */
const propertyController = {
  // -------------------------
  // 🔹 CRUD
  // -------------------------

  async create(req, res) {
    try {
      const property = await Property.create(req.body);
      await invalidatePropertyCaches();
      res
        .status(201)
        .json({ success: true, message: "successful", data: property });
    } catch (error) {
      console.error("Error creating property:", error);
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
      const property = await Property.findById(id);
      if (!property)
        return res.status(404).json({ error: "Property not found" });
      await redis.setJSON(cacheKey, property, CACHE_TTL_SECONDS);
      res.json({ success: true, message: "successful", data: property });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const boardId = await resolveBoardIdForGame(req.query.board_id);
      const cacheKey = `properties:v1:${boardId}`;
      const cached = await redis.getJSON(cacheKey);
      if (cached) {
        return res.json({ success: true, message: "successful", data: cached });
      }
      const { limit, offset } = req.query;
      const canonical = await Property.findAll({
        limit: Number.parseInt(limit) || 100,
        offset: Number.parseInt(offset) || 0,
      });
      const properties = await mergeCanonicalPropertiesWithVariant(canonical, boardId);
      await redis.setJSON(cacheKey, properties, CACHE_TTL_SECONDS);
      res.json({ success: true, message: "successful", data: properties });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async update(req, res) {
    try {
      const property = await Property.update(req.params.id, req.body);
      await invalidatePropertyCaches(req.params.id);
      res.json({ success: true, message: "successful", data: property });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async remove(req, res) {
    try {
      await Property.delete(req.params.id);
      await invalidatePropertyCaches(req.params.id);
      res.json({ success: true, message: "successful", data: null });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};

export default propertyController;
