/**
 * GROUP_ELIMINATION: store all entries that advance from a pod (top 2 from 3–4 player tables).
 * Final four championship (one table of 4) stores a single id — winner only.
 */
export const up = async (knex) => {
  await knex.schema.alterTable("tournament_matches", (table) => {
    table.json("advancing_entry_ids").nullable();
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable("tournament_matches", (table) => {
    table.dropColumn("advancing_entry_ids");
  });
};
