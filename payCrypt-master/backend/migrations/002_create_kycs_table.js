export const up = async (knex) => {
  const exists = await knex.schema.hasTable("users");

  if (!exists) {
    return knex.schema.createTable("kyc", (table) => {
      table.increments("id").primary();
      table.integer("user_id").unsigned().notNullable();
      table.string("full_name", 255);
      table.string("phone_number", 255);
      table.string("bank_name", 255);
      table.string("account_number", 255);
      table.string("bvn", 255);
      table.string("status", 255).defaultTo("pending");
      table.string("id_document", 255);
      table.string("proof_of_address", 255);
      table.string("extra_document", 255);
      table.text("extra_content");
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at").defaultTo(knex.fn.now());

      table
        .foreign("user_id")
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table.index("user_id");
    });
  }
};

export const down = async (knex) => {
  return knex.schema.dropTableIfExists("kyc");
};
