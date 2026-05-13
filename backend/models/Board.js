import db from "../config/database.js";

const Board = {
  async findAll() {
    return await db("board_variants").where({ active: true }).orderBy("created_at", "asc");
  },

  async findById(id) {
    return await db("board_variants").where({ id }).first();
  },

  async create(boardData) {
    await db("board_variants").insert(boardData);
    return this.findById(boardData.id);
  },

  async update(id, boardData) {
    await db("board_variants").where({ id }).update(boardData);
    return this.findById(id);
  },

  async delete(id) {
    return await db("board_variants").where({ id }).del();
  },

  // Get all properties for a specific board
  async getPropertiesByBoardId(boardId) {
    return await db("properties").where({ board_id: boardId }).orderBy("id", "asc");
  },

  // Get board with its properties
  async findByIdWithProperties(id) {
    const board = await this.findById(id);
    if (!board) return null;

    const properties = await this.getPropertiesByBoardId(id);
    return { ...board, properties };
  },
};

export default Board;
