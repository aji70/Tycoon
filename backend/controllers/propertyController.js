import Property from "../models/Property.js";

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
      const property = await Property.findById(req.params.id);
      if (!property)
        return res.status(404).json({ error: "Property not found" });
      res.json({ success: true, message: "successful", data: property });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const { limit, offset } = req.query;
      const properties = await Property.findAll({
        limit: Number.parseInt(limit) || 100,
        offset: Number.parseInt(offset) || 0,
      });
      res.json({ success: true, message: "successful", data: properties });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async update(req, res) {
    try {
      const property = await Property.update(req.params.id, req.body);
      res.json({ success: true, message: "successful", data: property });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async remove(req, res) {
    try {
      await Property.delete(req.params.id);
      res.json({ success: true, message: "successful", data: null });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};

export default propertyController;
