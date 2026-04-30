/**
 * Add perk_bundles table for shop bundles.
 * Add last_daily_claim_at and login_streak to users for daily login rewards.
 */
export async function up(knex) {
  await knex.schema.createTableIfNotExists("perk_bundles", (table) => {
    table.increments("id").primary();
    table.string("name", 120).notNullable();
    table.text("description").nullable();
    table.json("token_ids").notNullable().comment("Array of collectible token IDs in this bundle");
    table.json("amounts").notNullable().comment("Array of quantities per token (same length as token_ids)");
    table.decimal("price_tyc", 24, 8).notNullable().defaultTo(0);
    table.decimal("price_usdc", 24, 6).notNullable().defaultTo(0);
    table.boolean("active").notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  const hasLastDailyClaim = await knex.schema.hasColumn("users", "last_daily_claim_at");
  if (!hasLastDailyClaim) {
    await knex.schema.alterTable("users", (table) => {
      table.dateTime("last_daily_claim_at").nullable();
      table.integer("login_streak").unsigned().notNullable().defaultTo(0);
    });
  }

  const count = await knex("perk_bundles").count({ c: "id" }).first();
  if (Number(count?.c || 0) === 0) {
    await knex("perk_bundles").insert([
      {
        name: "Starter Pack",
        description: "Shield, Roll Boost, and Exact Roll — great for new players.",
        token_ids: JSON.stringify([]),
        amounts: JSON.stringify([]),
        price_tyc: 45,
        price_usdc: 2.5,
        active: true,
      },
      {
        name: "Lucky Bundle",
        description: "Jail Free, Teleport, and Lucky 7. Get out of tight spots.",
        token_ids: JSON.stringify([]),
        amounts: JSON.stringify([]),
        price_tyc: 60,
        price_usdc: 3,
        active: true,
      },
    ]);
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("perk_bundles");
  if (await knex.schema.hasColumn("users", "last_daily_claim_at")) {
    await knex.schema.alterTable("users", (table) => {
      table.dropColumn("last_daily_claim_at");
      table.dropColumn("login_streak");
    });
  }
}
