/**
 * Board variants: alternate display names per square while sharing one canonical
 * `properties` row (rent, houses, grid) per id.
 */

const METRO_NAMES = {
  0: "Terminus",
  1: "Westgate",
  2: "Community Fund",
  3: "Eastgate",
  4: "City Levy",
  5: "Central Line",
  6: "North Plaza",
  7: "Lucky Draw",
  8: "Market Row",
  9: "Harbor Front",
  10: "Holding Cell",
  11: "Old Quarter",
  12: "Power Grid",
  13: "Canal Side",
  14: "Riverside",
  15: "Express North",
  16: "Hill District",
  17: "Community Fund",
  18: "Midtown",
  19: "Central Park",
  20: "Lot Stop",
  21: "Uptown",
  22: "Lucky Draw",
  23: "West End",
  24: "East End",
  25: "Express West",
  26: "Seaside",
  27: "Pier Promenade",
  28: "Waterworks",
  29: "Palm Row",
  30: "Detention",
  31: "Sunset Blvd",
  32: "Highland Ave",
  33: "Community Fund",
  34: "Mansion Row",
  35: "Express South",
  36: "Lucky Draw",
  37: "Sky Tower",
  38: "Premium Tax",
  39: "Ocean Promenade",
};

export const up = async (knex) => {
  const hasVariants = await knex.schema.hasTable("board_variants");
  if (!hasVariants) {
    throw new Error("board_variants table missing — run migration 020_create_board_variants first");
  }

  await knex.schema.createTable("board_variant_square_names", (table) => {
    table.string("board_variant_id", 64).notNullable();
    table.integer("property_id").unsigned().notNullable();
    table.string("display_name", 255).notNullable();
    table.primary(["board_variant_id", "property_id"]);
    table
      .foreign("board_variant_id")
      .references("id")
      .inTable("board_variants")
      .onDelete("CASCADE");
    table.foreign("property_id").references("id").inTable("properties").onDelete("CASCADE");
  });

  const variantRows = [
    {
      id: "default",
      name: "Tycoon",
      region: "Default",
      description: "Original square names from the property catalog.",
      flag_url: "/game/go.svg",
      property_count: 40,
      active: true,
    },
    {
      id: "metro",
      name: "Metro City",
      region: "Theme",
      description: "Urban transit–themed labels (same prices and rents).",
      flag_url: "/game/go.svg",
      property_count: 40,
      active: true,
    },
  ];

  for (const row of variantRows) {
    await knex.raw(
      `INSERT INTO board_variants (id, name, region, description, flag_url, property_count, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE name = VALUES(name), region = VALUES(region), description = VALUES(description),
         flag_url = VALUES(flag_url), property_count = VALUES(property_count), active = VALUES(active), updated_at = NOW()`,
      [row.id, row.name, row.region, row.description, row.flag_url, row.property_count, row.active ? 1 : 0],
    );
  }

  const nameRows = Object.entries(METRO_NAMES).map(([property_id, display_name]) => ({
    board_variant_id: "metro",
    property_id: Number(property_id),
    display_name,
  }));

  await knex.batchInsert("board_variant_square_names", nameRows, 50);
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("board_variant_square_names");
};
