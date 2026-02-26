/**
 * Add placements (JSON) to games table.
 * When game finishes by time, placements = { user_id: position } where 1 = winner.
 */
export const up = (knex) => {
  return knex.schema.table("games", (table) => {
    table.json("placements").nullable();
  });
};

export const down = (knex) => {
  return knex.schema.table("games", (table) => {
    table.dropColumn("placements");
  });
};
