import db from "../config/database.js";

const Balance = {
  async create(balanceData) {
    const [id] = await db("balances").insert(balanceData);
    return this.findById(id);
  },

  async findById(id) {
    return await db("balances")
      .select(
        "balances.*",
        "users.email as user_email",
        "users.tag as user_tag",
        "tokens.name as token_name",
        "tokens.symbol as token_symbol",
        "tokens.logo_url as token_logo_url",
        "tokens.price as token_price"
      )
      .leftJoin("users", "balances.user_id", "users.id")
      .leftJoin("tokens", "balances.token_id", "tokens.id")
      .where("balances.id", id)
      .first();
  },

  async findByAddress(address) {
    return await db("balances").where({ address }).first();
  },

  async findByUserIdAndTokenId(user_id, token_id) {
    return await db("balances").where({ user_id, token_id }).first();
  },

  async getAll(limit = 10, offset = 0) {
    return await db("balances")
      .select(
        "balances.*",
        "users.email as user_email",
        "users.tag as user_tag",
        "tokens.name as token_name",
        "tokens.symbol as token_symbol",
        "tokens.logo_url as token_logo_url",
        "tokens.price as token_price"
      )
      .leftJoin("users", "balances.user_id", "users.id")
      .leftJoin("tokens", "balances.token_id", "tokens.id")
      .limit(limit)
      .offset(offset)
      .orderBy("balances.created_at", "desc");
  },

  async getByUser(userId, limit = 10, offset = 0) {
    return await db("balances")
      .select(
        "balances.*",
        "users.email as user_email",
        "users.tag as user_tag",
        "tokens.name as token_name",
        "tokens.symbol as token_symbol",
        "tokens.logo_url as token_logo_url",
        "tokens.price as token_price"
      )
      .leftJoin("users", "balances.user_id", "users.id")
      .leftJoin("tokens", "balances.token_id", "tokens.id")
      .where("balances.user_id", userId)
      .limit(limit)
      .offset(offset)
      .orderBy("balances.created_at", "desc");
  },

  async totalBalance() {
    return await db("balances").sum("usd_value as amount");
  },

  async totalBalanceByUser(userId) {
    return await db("balances")
      .where("user_id", userId)
      .sum("usd_value as amount");
  },

  async credit(id, amount) {
    await db("balances").where({ id }).increment("amount", amount);
    return this.findById(id);
  },

  async debit(id, amount) {
    await db("balances").where({ id }).decrement("amount", amount);
    return this.findById(id);
  },

  async update(id, balanceData) {
    await db("balances")
      .where({ id })
      .update({
        ...balanceData,
        updated_at: db.fn.now(),
      });
    return this.findById(id);
  },

  async delete(id) {
    return await db("balances").where({ id }).del();
  },
};

export default Balance;
