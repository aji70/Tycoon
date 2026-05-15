import db from "../config/database.js";

const Property = {
  async create(propertyData) {
    const [id] = await db("properties").insert(propertyData);
    return this.findById(id);
  },

  /** Canonical catalog rows only (same economics for every board name variant). */
  async findAll() {
    return await db("properties").whereNull("board_id").orderBy("id", "asc");
  },

  async find(id) {
    return await db("properties").where({ id }).first();
  },

  async findById(id) {
    return await db("properties").where({ id }).first();
  },

  async update(id, propertyData) {
    await db("properties").where({ id }).update(propertyData);
    return this.findById(id);
  },

  async delete(id) {
    return await db("properties").where({ id }).del();
  },
};

export default Property;
