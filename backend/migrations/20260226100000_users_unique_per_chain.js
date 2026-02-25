/**
 * Allow the same username on different chains, and the same address on different chains.
 * - Drop global unique on username and address.
 * - Add composite unique (username, chain) and (address, chain).
 */
export const up = async (knex) => {
  await knex.schema.alterTable("users", (table) => {
    table.dropUnique(["username"]);
    table.dropUnique(["address"]);
    table.unique(["username", "chain"]);
    table.unique(["address", "chain"]);
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable("users", (table) => {
    table.dropUnique(["username", "chain"]);
    table.dropUnique(["address", "chain"]);
    table.unique(["username"]);
    table.unique(["address"]);
  });
};
