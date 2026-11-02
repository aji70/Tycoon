/**
 * GoodDollar (G$) shop purchases: off-chain-verified G$ ERC-20 transfer, then
 * backend-minter calls deliverCollectible/deliverBundle. tx_hash is unique to
 * prevent replay / double-delivery.
 */

export const up = async (knex) => {
  const exists = await knex.schema.hasTable("gooddollar_shop_purchases");
  if (exists) return;
  await knex.schema.createTable("gooddollar_shop_purchases", (table) => {
    table.increments("id").primary();
    table.string("tx_hash", 66).notNullable();
    table.integer("user_id").unsigned().nullable();
    table.string("buyer_address", 42).notNullable();
    table.string("delivery_address", 42).notNullable();
    table.string("token_id", 32).nullable();
    table.integer("bundle_id").nullable();
    table.string("amount_gd_wei", 80).notNullable();
    table.string("status", 20).notNullable().defaultTo("pending");
    table.string("delivery_tx_hash", 66).nullable();
    table.string("error", 400).nullable();
    table.timestamp("fulfilled_at").nullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
    table.unique(["tx_hash"]);
    table.index(["status"]);
    table.index(["buyer_address"]);
    table.index(["user_id"]);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("gooddollar_shop_purchases");
};
