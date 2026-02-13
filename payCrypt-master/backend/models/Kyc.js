import db from "../config/database.js";

const Kyc = {
  async create(kycData) {
    const [id] = await db("kyc").insert(kycData);
    return this.findById(id);
  },

  async findById(id) {
    return await db("kyc")
      .select("kyc.*", "users.email as user_email", "users.tag as user_tag")
      .leftJoin("users", "kyc.user_id", "users.id")
      .where("kyc.id", id)
      .first();
  },

  async getAll(limit = 10, offset = 0) {
    return await db("kyc")
      .select("kyc.*", "users.email as user_email", "users.tag as user_tag")
      .leftJoin("users", "kyc.user_id", "users.id")
      .limit(limit)
      .offset(offset)
      .orderBy("kyc.created_at", "desc");
  },

  async getByUser(userId, limit = 10, offset = 0) {
    return await db("kyc")
      .where({ user_id: userId })
      .limit(limit)
      .offset(offset)
      .orderBy("created_at", "desc");
  },

  async update(id, kycData) {
    await db("kyc")
      .where({ id })
      .update({
        ...kycData,
        updated_at: db.fn.now(),
      });
    return this.findById(id);
  },

  async delete(id) {
    return await db("kyc").where({ id }).del();
  },
};

export default Kyc;
