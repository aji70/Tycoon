import db from "../config/database.js";

const Wallet = {
  async create(walletData) {
    const [id] = await db("wallets").insert(walletData);
    return this.findById(id);
  },

  async findById(id) {
    return await db("wallets")
      .select(
        "wallets.*",
        "users.email",
        "users.tag",
        "bank_accounts.bank_name",
        "bank_accounts.bank_code",
        "bank_accounts.account_name",
        "bank_accounts.account_number"
      )
      .leftJoin("users", "wallets.user_id", "users.id")
      .leftJoin("bank_accounts", "wallets.user_id", "bank_accounts.user_id")
      .where("wallets.id", id)
      .first();
  },

  async getAll(limit = 10, offset = 0) {
    return await db("wallets")
      .select(
        "wallets.*",
        "users.email",
        "users.tag",
        "bank_accounts.bank_name",
        "bank_accounts.bank_code",
        "bank_accounts.account_name",
        "bank_accounts.account_number"
      )
      .leftJoin("users", "wallets.user_id", "users.id")
      .leftJoin("bank_accounts", "wallets.user_id", "bank_accounts.user_id")
      .limit(limit)
      .offset(offset)
      .orderBy("wallets.created_at", "desc");
  },

  async getByUser(userId) {
    return await db("wallets")
      .select(
        "wallets.*",
        "users.email",
        "users.tag",
        "bank_accounts.bank_name",
        "bank_accounts.bank_code",
        "bank_accounts.account_name",
        "bank_accounts.account_number"
      )
      .leftJoin("users", "wallets.user_id", "users.id")
      .leftJoin("bank_accounts", "wallets.user_id", "bank_accounts.user_id")
      .where("wallets.user_id", userId)
      .limit(limit)
      .offset(offset)
      .orderBy("wallets.created_at", "desc")
      .first();
  },

  async getByUserId(user_id) {
    return await db("wallets").where({ user_id }).first();
  },

  async credit(id, amount) {
    await db("wallets").where({ id }).increment("balance", amount);
    return this.findById(id);
  },

  async debit(id, amount) {
    await db("wallets").where({ id }).decrement("balance", amount);
    return this.findById(id);
  },

  async update(id, walletData) {
    await db("wallets")
      .where({ id })
      .update({
        ...walletData,
        updated_at: db.fn.now(),
      });
    return this.findById(id);
  },

  async delete(id) {
    return await db("wallets").where({ id }).del();
  },
};

export default Wallet;
