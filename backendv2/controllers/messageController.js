import Message from "../models/Message.js";

/**
 * Message Controller
 *
 * Handles requests related to message
 */
const messageController = {
  // -------------------------
  // 🔹 CRUD
  // -------------------------

  async create(req, res) {
    try {
      const message = await Message.create(req.body);
      res
        .status(201)
        .json({ success: true, message: "successful", data: message });
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async findById(req, res) {
    try {
      const { id } = req.params;
      const message = await Message.findById(req.params.id);
      if (!message) return res.status(404).json({ error: "Message not found" });
      res.json({ success: true, message: "successful", data: message });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findByGameId(req, res) {
    try {
      const { id } = req.params;
      const message = await Message.findAllByMessagesByGameId(req.params.id);
      if (!message) return res.status(404).json({ error: "Message not found" });
      res.json({ success: true, message: "successful", data: message });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findByChatId(req, res) {
    try {
      const { id } = req.params;
      const message = await Message.findAllByMessagesByChatId(req.params.id);
      if (!message) return res.status(404).json({ error: "Message not found" });
      res.json({ success: true, message: "successful", data: message });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const { limit, offset } = req.query;
      const messages = await Message.findAll({
        limit: Number.parseInt(limit) || 100,
        offset: Number.parseInt(offset) || 0,
      });
      res.json({ success: true, message: "successful", data: messages });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async update(req, res) {
    try {
      const message = await Message.update(req.params.id, req.body);
      res.json({ success: true, message: "successful", data: message });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async remove(req, res) {
    try {
      await Message.delete(req.params.id);
      res.json({ success: true, message: "successful", data: null });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};

export default messageController;
