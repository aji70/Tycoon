/**
 * Soft perk purchases (TycoonSoftPerkCatalog buyPerk → treasury = RewardSystem).
 */

export const up = async (knex) => {
  const exists = await knex.schema.hasTable("soft_perk_purchases");
  if (!exists) {
    await knex.schema.createTable("soft_perk_purchases", (table) => {
      table.increments("id").primary();
      table.integer("user_id").unsigned().notNullable();
      table.integer("game_id").unsigned().nullable();
      table.string("perk_id", 66).notNullable();
      table.string("tx_hash", 66).notNullable();
      table.string("entitlement", 64).notNullable().defaultTo("generic");
      table.json("entitlement_payload").nullable();
      table.string("amount", 78).notNullable().defaultTo("0");
      table.integer("payment_token").unsigned().notNullable().defaultTo(1);
      table.string("treasury", 42).nullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.unique(["tx_hash"]);
      table.index(["user_id", "perk_id"]);
      table.index(["perk_id"]);
    });
  }
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("soft_perk_purchases");
};
