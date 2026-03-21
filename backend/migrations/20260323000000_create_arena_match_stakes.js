/**
 * arena_match_stakes — tracks staked arena matches for fund collection and payout.
 * Links game_id to stake amount and tournament/escrow for payout on completion.
 */

export const up = async (knex) => {
  await knex.schema.createTable("arena_match_stakes", (table) => {
    table.increments("id").primary();
    table.integer("game_id").unsigned().notNullable().unique().index();
    table.foreign("game_id").references("games.id").onDelete("CASCADE");
    table.integer("tournament_id").unsigned().nullable().index();
    table.string("stake_amount_usdc", 64).notNullable();
    table.string("chain", 32).notNullable().defaultTo("CELO");
    table.enum("status", ["PENDING", "COLLECTED", "PAID_OUT", "FAILED"]).notNullable().defaultTo("PENDING");
    table.timestamp("collected_at").nullable();
    table.timestamp("paid_out_at").nullable();
    table.timestamps(true, true);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("arena_match_stakes");
};
