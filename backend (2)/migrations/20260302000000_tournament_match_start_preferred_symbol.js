/**
 * Allow "Start now" requester to choose their token: store preferred_symbol on tournament_match_start_requests.
 */
export const up = async (knex) => {
  await knex.schema.alterTable("tournament_match_start_requests", (table) => {
    table.string("preferred_symbol", 32).nullable().comment("Token/symbol the requester wants (e.g. car, hat)");
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable("tournament_match_start_requests", (table) => {
    table.dropColumn("preferred_symbol");
  });
};
