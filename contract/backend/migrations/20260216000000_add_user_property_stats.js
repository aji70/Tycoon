/**
 * Add user property/trade stats and property purchase log for favourite property tracking.
 * - users: properties_bought, properties_sold, trades_initiated, trades_accepted
 * - user_property_purchases: log each property buy (user_id, property_id, game_id, source) for favourite property
 * Idempotent: skips steps that already ran (handles partial migration recovery).
 */
export const up = async (knex) => {
  const hasPropertiesBought = await knex.schema.hasColumn("users", "properties_bought");
  if (!hasPropertiesBought) {
    await knex.schema.table("users", (table) => {
      table.integer("properties_bought").unsigned().notNullable().defaultTo(0);
      table.integer("properties_sold").unsigned().notNullable().defaultTo(0);
      table.integer("trades_initiated").unsigned().notNullable().defaultTo(0);
      table.integer("trades_accepted").unsigned().notNullable().defaultTo(0);
    });
  }

  const hasUserPropertyPurchases = await knex.schema.hasTable("user_property_purchases");
  if (!hasUserPropertyPurchases) {
  await knex.schema.createTable("user_property_purchases", (table) => {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable();
    table.integer("property_id").notNullable(); // Match properties.id (signed)
    table.integer("game_id").unsigned().notNullable();
    table.enum("source", ["bank", "trade"]).notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.foreign("user_id").references("users.id").onDelete("CASCADE");
    table.foreign("property_id").references("properties.id");
    table.foreign("game_id").references("games.id");
    table.index(["user_id", "property_id"]);
  });
  }
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("user_property_purchases");
  if (await knex.schema.hasColumn("users", "properties_bought")) {
    await knex.schema.table("users", (table) => {
      table.dropColumn("properties_bought");
      table.dropColumn("properties_sold");
      table.dropColumn("trades_initiated");
      table.dropColumn("trades_accepted");
    });
  }
};
