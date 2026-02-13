import db from "../config/database.js";

const Token = {
  async create(tokenData) {
    const [id] = await db("tokens").insert(tokenData);
    return this.findById(id);
  },

  async findBySymbol(symbol) {
    return await db("tokens").where({ symbol }).first();
  },

  async findById(id) {
    return await db("tokens").where({ id }).first();
  },

  async getAll(limit = 10, offset = 0) {
    return await db("tokens")
      // .limit(limit)
      // .offset(offset)
      .orderBy("created_at", "desc");
  },

  async update(id, tokenData) {
    await db("tokens")
      .where({ id })
      .update({
        ...tokenData,
        updated_at: db.fn.now(),
      });
    return this.findById(id);
  },

  async delete(id) {
    return await db("tokens").where({ id }).del();
  },
};

export default Token;
