import redis from "../config/redis.js";
import Board from "../models/Board.js";
import logger from "../config/logger.js";

const boardController = {
  // Get all available board variants
  async getAllBoards(req, res) {
    try {
      const cacheKey = "boards:all";
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: JSON.parse(cached) });
      }

      const boards = await Board.findAll();
      await redis.set(cacheKey, JSON.stringify(boards), "EX", 3600); // Cache 1 hour
      res.json({ success: true, data: boards });
    } catch (error) {
      logger.error({ err: error }, "boardController.getAllBoards error");
      res.status(500).json({ success: false, message: "Failed to fetch boards" });
    }
  },

  // Get a specific board by ID
  async getBoardById(req, res) {
    try {
      const { id } = req.params;
      const cacheKey = `board:${id}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: JSON.parse(cached) });
      }

      const board = await Board.findById(id);
      if (!board) {
        return res.status(404).json({ success: false, message: "Board not found" });
      }

      await redis.set(cacheKey, JSON.stringify(board), "EX", 3600);
      res.json({ success: true, data: board });
    } catch (error) {
      logger.error({ err: error }, "boardController.getBoardById error");
      res.status(500).json({ success: false, message: "Failed to fetch board" });
    }
  },

  // Get board with properties
  async getBoardWithProperties(req, res) {
    try {
      const { id } = req.params;
      const cacheKey = `board:${id}:properties`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: JSON.parse(cached) });
      }

      const boardWithProps = await Board.findByIdWithProperties(id);
      if (!boardWithProps) {
        return res.status(404).json({ success: false, message: "Board not found" });
      }

      await redis.set(cacheKey, JSON.stringify(boardWithProps), "EX", 3600);
      res.json({ success: true, data: boardWithProps });
    } catch (error) {
      logger.error({ err: error }, "boardController.getBoardWithProperties error");
      res.status(500).json({ success: false, message: "Failed to fetch board with properties" });
    }
  },

  // Get properties for a specific board
  async getBoardProperties(req, res) {
    try {
      const { id } = req.params;
      const cacheKey = `board:${id}:props`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: JSON.parse(cached) });
      }

      const properties = await Board.getPropertiesByBoardId(id);
      if (!properties || properties.length === 0) {
        return res.status(404).json({ success: false, message: "Board properties not found" });
      }

      await redis.set(cacheKey, JSON.stringify(properties), "EX", 3600);
      res.json({ success: true, data: properties });
    } catch (error) {
      logger.error({ err: error }, "boardController.getBoardProperties error");
      res.status(500).json({ success: false, message: "Failed to fetch board properties" });
    }
  },

  // Create new board (admin only)
  async createBoard(req, res) {
    try {
      const { id, name, region, description, flag_url, property_count } = req.body;

      if (!id || !name || !region || !flag_url) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      const board = await Board.create({
        id,
        name,
        region,
        description,
        flag_url,
        property_count: property_count || 40,
        active: true,
      });

      // Clear cache
      await redis.del("boards:all");

      res.status(201).json({ success: true, data: board });
    } catch (error) {
      logger.error({ err: error }, "boardController.createBoard error");
      res.status(500).json({ success: false, message: "Failed to create board" });
    }
  },
};

export default boardController;
