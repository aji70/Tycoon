import Chat from "../models/Chat.js";

/**
 * Chat Controller
 *
 * Handles requests related to chat
 */
const chatController = {
  // -------------------------
  // 🔹 CRUD
  // -------------------------

  async create(req, res) {
    try {
      const chat = await Chat.create(req.body);
      res
        .status(201)
        .json({ success: true, message: "successful", data: chat });
    } catch (error) {
      console.error("Error creating chat:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async findById(req, res) {
    try {
      const { id } = req.params;
      const chat = await Chat.findById(req.params.id);
      if (!chat) return res.status(404).json({ error: "Chat not found" });
      res.json({ success: true, message: "successful", data: chat });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findByGameId(req, res) {
    try {
      const { id } = req.params;
      const chat = await Chat.findByGameId(req.params.id);
      if (!chat) return res.status(404).json({ error: "Chat not found" });
      res.json({ success: true, message: "successful", data: chat });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const { limit, offset } = req.query;
      const chats = await Chat.findAll({
        limit: Number.parseInt(limit) || 100,
        offset: Number.parseInt(offset) || 0,
      });
      res.json({ success: true, message: "successful", data: chats });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async update(req, res) {
    try {
      const chat = await Chat.update(req.params.id, req.body);
      res.json({ success: true, message: "successful", data: chat });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async remove(req, res) {
    try {
      await Chat.delete(req.params.id);
      res.json({ success: true, message: "successful", data: null });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  async updateByGameId(req, res) {
    try {
      const chat = await Chat.updateByGameId(req.params.id, req.body);
      res.json({ success: true, message: "successful", data: chat });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async removeByGameId(req, res) {
    try {
      await Chat.deleteByGameId(req.params.id);
      res.json({ success: true, message: "successful", data: null });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};

export default chatController;
