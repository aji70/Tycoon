export const up = (knex) => {
  return knex.schema.table("games", (table) => {
    table.boolean("is_ai").nullable().defaultTo(false);
    table.boolean("is_minipay").nullable().defaultTo(false);
    table.string("chain").nullable();
    table.string("duration").nullable();
  });
};

export const down = (knex) => {
  return knex.schema.table("games", (table) => {
    table.dropColumn("is_ai");
    table.dropColumn("is_minipay");
    table.dropColumn("chain");
    table.dropColumn("duration");
  });
};
