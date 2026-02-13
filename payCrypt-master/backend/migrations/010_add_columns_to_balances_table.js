export const up = async (knex) => {
  const exists = await knex.schema.hasColumn(
    "balances",
    "auto_convert_threshold"
  );

  if (!exists) {
    await knex.schema.table("balances", (table) => {
      table.string("auto_convert_threshold", 255).nullable();
    });
  }
};

export const down = async (knex) => {
  const exists = await knex.schema.hasColumn(
    "balances",
    "auto_convert_threshold"
  );

  if (exists) {
    await knex.schema.table("balances", (table) => {
      table.dropColumn("auto_convert_threshold");
    });
  }
};