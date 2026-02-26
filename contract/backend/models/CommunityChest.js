import db from "../config/database.js";

const CommunityChest = {
  async create(communityChestData) {
    const [id] = await db("community_chests").insert(communityChestData);
    return this.findById(id);
  },

  async findAll() {
    return await db("community_chests").orderBy("id", "asc");
  },

  async find(id) {
    return await db("community_chests").where({ id }).first();
  },

  async findById(id) {
    return await db("community_chests").where({ id }).first();
  },

  async update(id, communityChestData) {
    await db("community_chests").where({ id }).update(communityChestData);
    return this.findById(id);
  },

  async delete(id) {
    return await db("community_chests").where({ id }).del();
  },
};

export default CommunityChest;
