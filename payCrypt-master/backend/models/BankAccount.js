import db from "../config/database.js";

const BankAccount = {
  async create(bankAccountData) {
    const [id] = await db("bank_accounts").insert(bankAccountData);
    return this.findById(id);
  },

  async findById(id) {
    return await db("bank_accounts")
      .select("bank_accounts.*", "users.email", "users.tag")
      .leftJoin("users", "bank_accounts.user_id", "users.id")
      .where("bank_accounts.id", id)
      .first();
  },

  async getAll(limit = 10, offset = 0) {
    return await db("bank_accounts")
      .select("bank_accounts.*", "users.email", "users.tag")
      .leftJoin("users", "bank_accounts.user_id", "users.id")
      .limit(limit)
      .offset(offset)
      .orderBy("bank_accounts.created_at", "desc");
  },

  async getByUserId(user_id) {
    return await db("bank_accounts").where({ user_id }).first();
  },

  async update(id, bankAccountData) {
    await db("bank_accounts")
      .where({ id })
      .update({
        ...bankAccountData,
        updated_at: db.fn.now(),
      });
    return this.findById(id);
  },

  async delete(id) {
    return await db("bank_accounts").where({ id }).del();
  },
};

export default BankAccount;
