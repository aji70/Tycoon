/**
 * Add contract_game_id to games so backend can call Tycoon contract (setTurnCount, removePlayerFromGame).
 * Frontend sends on-chain game id as `id` when creating a game; backend should store it here.
 */
export const up = (knex) => {
  return knex.schema.table("games", (table) => {
    table.string("contract_game_id", 78).nullable().comment("On-chain Tycoon game id (bigint as string)");
  });
};

export const down = (knex) => {
  return knex.schema.table("games", (table) => {
    table.dropColumn("contract_game_id");
  });
};
