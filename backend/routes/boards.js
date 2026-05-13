import express from "express";
import boardController from "../controllers/boardController.js";

const router = express.Router();

// Get all available boards
router.get("/", boardController.getAllBoards);

// Get specific board by ID
router.get("/:id", boardController.getBoardById);

// Get board with its properties
router.get("/:id/with-properties", boardController.getBoardWithProperties);

// Get properties for a specific board
router.get("/:id/properties", boardController.getBoardProperties);

// Create new board (admin - can add auth middleware later)
router.post("/", boardController.createBoard);

export default router;
