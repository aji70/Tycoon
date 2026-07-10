/**
 * Stake amount on player challenges (USDC units, human-readable e.g. 5.000000).
 */
export const up = async (knex) => {
  const has = await knex.schema.hasColumn("player_challenges", "stake");
  if (has) return;
  await knex.schema.alterTable("player_challenges", (table) => {
    table.decimal("stake", 18, 6).notNullable().defaultTo(0);
  });
};

export const down = async (knex) => {
  const has = await knex.schema.hasColumn("player_challenges", "stake");
  if (!has) return;
  await knex.schema.alterTable("player_challenges", (table) => {
    table.dropColumn("stake");
  });
};
