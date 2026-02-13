import db from "../config/database.js";

const Chain = {
  async create(chainData) {
    const [id] = await db("chains").insert(chainData);
    return this.findById(id);
  },

  async findById(id) {
    return await db("chains").where({ id }).first();
  },

  async getAll(limit = 10, offset = 0) {
    return await db("chains")
      .limit(limit)
      .offset(offset)
      .orderBy("created_at", "desc");
  },

  async update(id, chainData) {
    await db("chains")
      .where({ id })
      .update({
        ...chainData,
        updated_at: db.fn.now(),
      });
    return this.findById(id);
  },

  async delete(id) {
    return await db("chains").where({ id }).del();
  },
};

export default Chain;
