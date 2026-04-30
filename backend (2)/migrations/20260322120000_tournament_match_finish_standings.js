/**
 * Persist final table order per bracket match (entry_id + place) when the game ends.
 * Lobby / GET bracket can show Results without re-deriving AI seat → placement mapping.
 */
export const up = async (knex) => {
  await knex.schema.alterTable("tournament_matches", (table) => {
    table.string("game_code", 48).nullable();
    table.json("finish_standings").nullable();
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable("tournament_matches", (table) => {
    table.dropColumn("game_code");
    table.dropColumn("finish_standings");
  });
};
