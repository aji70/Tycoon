import db from "../config/database.js";

const Tournament = {
  async create(data) {
    const [id] = await db("tournaments").insert(data);
    return this.findById(id);
  },

  async findById(id) {
    return db("tournaments").where({ id }).first();
  },

  async findAll({ limit = 50, offset = 0, status = null, chain = null, prize_source = null } = {}) {
    const query = db("tournaments").select("*").orderBy("created_at", "desc").limit(limit).offset(offset);
    if (status) query.where("status", status);
    if (chain) query.where("chain", chain);
    if (prize_source) query.where("prize_source", prize_source);
    return query;
  },

  async update(id, data) {
    await db("tournaments").where({ id }).update({ ...data, updated_at: db.fn.now() });
    return this.findById(id);
  },

  async delete(id) {
    return db("tournaments").where({ id }).del();
  },
};

export default Tournament;
