/** Marks arena post-game (stakes / ELO) handled so human-vs-agent games are not reprocessed forever. */
export const up = async (knex) => {
  await knex.schema.table("games", (table) => {
    table.timestamp("arena_completion_at").nullable().index();
  });
};

export const down = async (knex) => {
  await knex.schema.table("games", (table) => {
    table.dropColumn("arena_completion_at");
  });
};
