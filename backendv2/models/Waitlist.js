import db from "../config/database.js";

const Waitlist = {
  async create(waitlistData) {
    const [id] = await db("waitlists").insert(waitlistData);
    return this.findById(id);
  },

  async findAll() {
    return await db("waitlists").orderBy("id", "asc");
  },

  async find(id) {
    return await db("waitlists").where({ id }).first();
  },

  async findById(id) {
    return await db("waitlists").where({ id }).first();
  },

  async update(id, waitlistData) {
    await db("waitlists").where({ id }).update(waitlistData);
    return this.findById(id);
  },

  async delete(id) {
    return await db("waitlists").where({ id }).del();
  },
};

export default Waitlist;
