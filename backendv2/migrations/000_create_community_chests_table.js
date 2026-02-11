export const up = async (knex) => {
  return knex.schema.createTable("community_chests", (table) => {
    table.integer("id").primary();
    table.text("instruction").notNullable();

    // 'credit', 'debit', 'move', 'credit_and_move', 'debit_and_move', 'special'
    table.string("type", 50).notNullable();

    // direct amount (e.g. 200, -50), nullable if movement or per_house/hotel applies
    table.integer("amount").nullable();

    // relative/absolute movement (0 = GO, 10 = Jail, -2 = back 2 steps, etc.)
    table.integer("position").nullable();

    // JSON for flexible rule extensions e.g. { "per_house": 25, "per_hotel": 100 }
    table.json("extra").nullable();
  });
};

export const down = async (knex) => {
  return knex.schema.dropTable("community_chests");
};
