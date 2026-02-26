import db from "../config/database.js";

const Chance = {
  async create(chanceData) {
    const [id] = await db("chances").insert(chanceData);
    return this.findById(id);
  },

  async findAll() {
    return await db("chances").orderBy("id", "asc");
  },

  async find(id) {
    return await db("chances").where({ id }).first();
  },

  async findById(id) {
    return await db("chances").where({ id }).first();
  },

  async update(id, chanceData) {
    await db("chances").where({ id }).update(chanceData);
    return this.findById(id);
  },

  async delete(id) {
    return await db("chances").where({ id }).del();
  },
};

export default Chance;
