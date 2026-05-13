/**
 * Seed board variants
 * Run with: npx knex seed:run --specific=01_board_variants.js
 */

export const seed = async (knex) => {
  // Clear existing data (optional, comment out if you want to keep existing boards)
  // await knex("board_variants").del();

  const boardVariants = [
    {
      id: "nigeria",
      name: "Nigeria",
      region: "West Africa",
      description: "Properties across Nigeria - the giant of Africa",
      flag_url: "/flags/nigeria.svg",
      property_count: 40,
      active: true,
    },
    {
      id: "kaduna-nigeria",
      name: "Kaduna",
      region: "Nigeria",
      description: "Properties in Kaduna, Nigeria - historic northern Nigerian city",
      flag_url: "/flags/kaduna.svg",
      property_count: 40,
      active: true,
    },
    {
      id: "ghana",
      name: "Ghana",
      region: "West Africa",
      description: "Properties across Ghana - the Gold Coast",
      flag_url: "/flags/ghana.svg",
      property_count: 40,
      active: true,
    },
    {
      id: "kenya",
      name: "Kenya",
      region: "East Africa",
      description: "Properties across Kenya - the cradle of humanity",
      flag_url: "/flags/kenya.svg",
      property_count: 40,
      active: true,
    },
    {
      id: "south-africa",
      name: "South Africa",
      region: "Southern Africa",
      description: "Properties across South Africa - the rainbow nation",
      flag_url: "/flags/south-africa.svg",
      property_count: 40,
      active: true,
    },
    {
      id: "indonesia",
      name: "Indonesia",
      region: "Southeast Asia",
      description: "Properties across Indonesia - archipelago of opportunities",
      flag_url: "/flags/indonesia.svg",
      property_count: 40,
      active: true,
    },
    {
      id: "philippines",
      name: "Philippines",
      region: "Southeast Asia",
      description: "Properties across the Philippines - pearl of the orient",
      flag_url: "/flags/philippines.svg",
      property_count: 40,
      active: true,
    },
    {
      id: "vietnam",
      name: "Vietnam",
      region: "Southeast Asia",
      description: "Properties across Vietnam - the rising tiger",
      flag_url: "/flags/vietnam.svg",
      property_count: 40,
      active: true,
    },
    {
      id: "colombia",
      name: "Colombia",
      region: "South America",
      description: "Properties across Colombia - magic realism and coffee",
      flag_url: "/flags/colombia.svg",
      property_count: 40,
      active: true,
    },
    {
      id: "brazil",
      name: "Brazil",
      region: "South America",
      description: "Properties across Brazil - the sleeping giant",
      flag_url: "/flags/brazil.svg",
      property_count: 40,
      active: true,
    },
    {
      id: "argentina",
      name: "Argentina",
      region: "South America",
      description: "Properties across Argentina - land of silver",
      flag_url: "/flags/argentina.svg",
      property_count: 40,
      active: true,
    },
    {
      id: "default",
      name: "Classic Monopoly",
      region: "Worldwide",
      description: "Traditional Monopoly board with classic properties",
      flag_url: "/bb.jpg",
      property_count: 40,
      active: true,
    },
  ];

  // Check which boards already exist
  for (const variant of boardVariants) {
    const exists = await knex("board_variants").where({ id: variant.id }).first();
    if (!exists) {
      await knex("board_variants").insert(variant);
    }
  }
};
