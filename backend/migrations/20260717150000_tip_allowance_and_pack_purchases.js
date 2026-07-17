/**
 * Tip packs: tip_allowance (base free tips + purchased) and idempotent pack purchases.
 */

export const up = async (knex) => {
  const hasAllowance = await knex.schema.hasColumn("game_ai_tip_usage", "tip_allowance");
  if (!hasAllowance) {
    await knex.schema.alterTable("game_ai_tip_usage", (table) => {
      table.integer("tip_allowance").unsigned().notNullable().defaultTo(3);
    });
  }

  const exists = await knex.schema.hasTable("game_ai_tip_pack_purchases");
  if (!exists) {
    await knex.schema.createTable("game_ai_tip_pack_purchases", (table) => {
      table.increments("id").primary();
      table.integer("user_id").unsigned().notNullable();
      table.integer("game_id").unsigned().notNullable();
      table.string("tx_hash", 66).notNullable();
      table.integer("tips_granted").unsigned().notNullable();
      table.string("amount_usdc", 32).notNullable().defaultTo("0.05");
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.unique(["tx_hash"]);
      table.index(["user_id", "game_id"]);
    });
  }
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("game_ai_tip_pack_purchases");
  const hasAllowance = await knex.schema.hasColumn("game_ai_tip_usage", "tip_allowance");
  if (hasAllowance) {
    await knex.schema.alterTable("game_ai_tip_usage", (table) => {
      table.dropColumn("tip_allowance");
    });
  }
};
