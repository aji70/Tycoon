/**
 * Add started_at to games.
 * When status becomes RUNNING (e.g. all players joined in multiplayer),
 * started_at is set so game duration countdown starts from then, not from created_at.
 */
export const up = (knex) => {
  return knex.schema.table("games", (table) => {
    table.timestamp("started_at").nullable();
  });
};

export const down = (knex) => {
  return knex.schema.table("games", (table) => {
    table.dropColumn("started_at");
  });
};
