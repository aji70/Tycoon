import crypto from "crypto";
import db from "../config/database.js";

function generateCode() {
  return crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 10).toUpperCase();
}

const Tournament = {
  async create(data) {
    let code = (data && data.code) ? String(data.code).trim().toUpperCase() : generateCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db("tournaments").where({ code }).first();
      if (!existing) break;
      code = generateCode();
      attempts += 1;
    }
    const { code: _c, ...rest } = data || {};
    const [id] = await db("tournaments").insert({ ...rest, code });
    return this.findById(id);
  },

  async findById(id) {
    return db("tournaments").where({ id }).first();
  },

  async findByCode(code) {
    return db("tournaments").where({ code }).first();
  },

  /** Resolve by id (number) or code (string). */
  async findByIdOrCode(idOrCode) {
    if (idOrCode == null || String(idOrCode).trim() === "") return null;
    const s = String(idOrCode).trim();
    const num = Number(s);
    if (!Number.isNaN(num) && String(num) === s) {
      return this.findById(num);
    }
    return this.findByCode(s.toUpperCase());
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
