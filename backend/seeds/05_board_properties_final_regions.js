/**
 * Final Regional Board Properties
 * South Africa, Indonesia, Philippines, Vietnam, Colombia, Argentina
 */

const getPropertiesForBoard = (boardId, properties) => {
  return properties.map((p, idx) => ({
    ...p,
    id: idx,
    board_id: boardId,
    grid_row: idx <= 9 ? 11 : idx <= 19 ? 11 - (idx - 10) : idx <= 29 ? 1 : (idx - 30) + 1,
    grid_col: idx <= 9 ? 11 - idx : idx <= 19 ? 1 : idx <= 29 ? (idx - 20) + 1 : 11,
  }));
};

const southAfricaProperties = [
  { name: "GO", type: "corner", price: 0, color: "#2ecc71", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Johannesburg CBD", type: "property", price: 60, color: "#8B4513", rent_site_only: 2, rent_one_house: 10, rent_two_houses: 30, rent_three_houses: 90, rent_four_houses: 160, rent_hotel: 250, cost_of_house: 50 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#8B4513", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Kruger National Park", type: "property", price: 60, color: "#8B4513", rent_site_only: 4, rent_one_house: 20, rent_two_houses: 60, rent_three_houses: 180, rent_four_houses: 320, rent_hotel: 450, cost_of_house: 50 },
  { name: "INCOME TAX", type: "income_tax", price: 0, color: "#fff", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "South African Railways", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Cape Town Waterfront", type: "property", price: 100, color: "#87CEEB", rent_site_only: 6, rent_one_house: 30, rent_two_houses: 90, rent_three_houses: 270, rent_four_houses: 400, rent_hotel: 550, cost_of_house: 50 },
  { name: "CHANCE", type: "chance", price: 0, color: "#87CEEB", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Table Mountain Resort", type: "property", price: 100, color: "#87CEEB", rent_site_only: 8, rent_one_house: 40, rent_two_houses: 100, rent_three_houses: 300, rent_four_houses: 450, rent_hotel: 600, cost_of_house: 50 },
  { name: "Durban Beach Commercial", type: "property", price: 120, color: "#87CEEB", rent_site_only: 10, rent_one_house: 50, rent_two_houses: 150, rent_three_houses: 450, rent_four_houses: 625, rent_hotel: 750, cost_of_house: 50 },
  { name: "JAIL/JUST VISITING", type: "corner", price: 0, color: "#7f8c8d", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Sandton Luxury District", type: "property", price: 140, color: "#FF69B4", rent_site_only: 12, rent_one_house: 60, rent_two_houses: 180, rent_three_houses: 500, rent_four_houses: 700, rent_hotel: 900, cost_of_house: 100 },
  { name: "Vaal Water Resources", type: "property", price: 150, color: "utility", rent_site_only: 4, rent_one_house: 10, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Pretoria Government District", type: "property", price: 140, color: "#FF69B4", rent_site_only: 14, rent_one_house: 70, rent_two_houses: 200, rent_three_houses: 550, rent_four_houses: 750, rent_hotel: 950, cost_of_house: 100 },
  { name: "Union Buildings", type: "property", price: 160, color: "#FF69B4", rent_site_only: 16, rent_one_house: 80, rent_two_houses: 220, rent_three_houses: 600, rent_four_houses: 800, rent_hotel: 1000, cost_of_house: 100 },
  { name: "Trans-Africa Express", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Bloemfontein CBD", type: "property", price: 180, color: "#FFA500", rent_site_only: 18, rent_one_house: 90, rent_two_houses: 250, rent_three_houses: 700, rent_four_houses: 875, rent_hotel: 1050, cost_of_house: 100 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#FFA500", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "OR Tambo Airport", type: "property", price: 180, color: "#FFA500", rent_site_only: 20, rent_one_house: 100, rent_two_houses: 300, rent_three_houses: 750, rent_four_houses: 925, rent_hotel: 1100, cost_of_house: 100 },
  { name: "Soweto Township District", type: "property", price: 200, color: "#FFA500", rent_site_only: 22, rent_one_house: 110, rent_two_houses: 330, rent_three_houses: 800, rent_four_houses: 975, rent_hotel: 1150, cost_of_house: 100 },
  { name: "FREE PARKING", type: "corner", price: 0, color: "#3498db", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Garden Route Commercial", type: "property", price: 220, color: "#FF0000", rent_site_only: 24, rent_one_house: 120, rent_two_houses: 360, rent_three_houses: 850, rent_four_houses: 1025, rent_hotel: 1200, cost_of_house: 150 },
  { name: "CHANCE", type: "chance", price: 0, color: "#FF0000", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Johannesburg Stock Exchange", type: "property", price: 220, color: "#FF0000", rent_site_only: 26, rent_one_house: 130, rent_two_houses: 390, rent_three_houses: 900, rent_four_houses: 1100, rent_hotel: 1300, cost_of_house: 150 },
  { name: "University of Witwatersrand", type: "property", price: 240, color: "#FF0000", rent_site_only: 28, rent_one_house: 150, rent_two_houses: 450, rent_three_houses: 1000, rent_four_houses: 1200, rent_hotel: 1400, cost_of_house: 150 },
  { name: "Coast to Coast Railway", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "East London Commercial", type: "property", price: 260, color: "#FFD700", rent_site_only: 30, rent_one_house: 160, rent_two_houses: 480, rent_three_houses: 1100, rent_four_houses: 1300, rent_hotel: 1500, cost_of_house: 150 },
  { name: "Port Elizabeth Premium", type: "property", price: 260, color: "#FFD700", rent_site_only: 32, rent_one_house: 170, rent_two_houses: 510, rent_three_houses: 1150, rent_four_houses: 1400, rent_hotel: 1600, cost_of_house: 150 },
  { name: "Eskom Power Corp", type: "property", price: 150, color: "utility", rent_site_only: 4, rent_one_house: 10, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Cape Town Gold Coast", type: "property", price: 280, color: "#FFD700", rent_site_only: 34, rent_one_house: 180, rent_two_houses: 540, rent_three_houses: 1200, rent_four_houses: 1500, rent_hotel: 1800, cost_of_house: 150 },
  { name: "GO TO JAIL", type: "corner", price: 0, color: "#e74c3c", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Hermanus Whale Coast", type: "property", price: 300, color: "#228B22", rent_site_only: 36, rent_one_house: 200, rent_two_houses: 600, rent_three_houses: 1400, rent_four_houses: 1700, rent_hotel: 2000, cost_of_house: 200 },
  { name: "Drakensberg Mountains", type: "property", price: 300, color: "#228B22", rent_site_only: 38, rent_one_house: 220, rent_two_houses: 660, rent_three_houses: 1500, rent_four_houses: 1800, rent_hotel: 2200, cost_of_house: 200 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#228B22", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "South African Metropolitan", type: "property", price: 320, color: "#228B22", rent_site_only: 40, rent_one_house: 220, rent_two_houses: 660, rent_three_houses: 1600, rent_four_houses: 1900, rent_hotel: 2400, cost_of_house: 200 },
  { name: "Eastern Cape Railway", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "CHANCE", type: "chance", price: 0, color: "#0000CD", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Four Seasons Luxury District", type: "property", price: 350, color: "#0000CD", rent_site_only: 45, rent_one_house: 250, rent_two_houses: 700, rent_three_houses: 1500, rent_four_houses: 1800, rent_hotel: 2200, cost_of_house: 200 },
  { name: "LUXURY TAX", type: "luxury_tax", price: 0, color: "#0000CD", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Johannesburg Gold Coast", type: "property", price: 400, color: "#0000CD", rent_site_only: 50, rent_one_house: 300, rent_two_houses: 750, rent_three_houses: 2000, rent_four_houses: 2400, rent_hotel: 2800, cost_of_house: 200 },
];

const colombiaProperties = [
  { name: "GO", type: "corner", price: 0, color: "#2ecc71", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Bogotá La Candelaria", type: "property", price: 60, color: "#8B4513", rent_site_only: 2, rent_one_house: 10, rent_two_houses: 30, rent_three_houses: 90, rent_four_houses: 160, rent_hotel: 250, cost_of_house: 50 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#8B4513", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Coffee Triangle Region", type: "property", price: 60, color: "#8B4513", rent_site_only: 4, rent_one_house: 20, rent_two_houses: 60, rent_three_houses: 180, rent_four_houses: 320, rent_hotel: 450, cost_of_house: 50 },
  { name: "INCOME TAX", type: "income_tax", price: 0, color: "#fff", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Colombian Railways", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Cartagena Caribbean Port", type: "property", price: 100, color: "#87CEEB", rent_site_only: 6, rent_one_house: 30, rent_two_houses: 90, rent_three_houses: 270, rent_four_houses: 400, rent_hotel: 550, cost_of_house: 50 },
  { name: "CHANCE", type: "chance", price: 0, color: "#87CEEB", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Lost City Eco-Lodge", type: "property", price: 100, color: "#87CEEB", rent_site_only: 8, rent_one_house: 40, rent_two_houses: 100, rent_three_houses: 300, rent_four_houses: 450, rent_hotel: 600, cost_of_house: 50 },
  { name: "Medellín Innovation Hub", type: "property", price: 120, color: "#87CEEB", rent_site_only: 10, rent_one_house: 50, rent_two_houses: 150, rent_three_houses: 450, rent_four_houses: 625, rent_hotel: 750, cost_of_house: 50 },
  { name: "JAIL/JUST VISITING", type: "corner", price: 0, color: "#7f8c8d", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Zona Rosa Commercial District", type: "property", price: 140, color: "#FF69B4", rent_site_only: 12, rent_one_house: 60, rent_two_houses: 180, rent_three_houses: 500, rent_four_houses: 700, rent_hotel: 900, cost_of_house: 100 },
  { name: "Cauca Water Resources", type: "property", price: 150, color: "utility", rent_site_only: 4, rent_one_house: 10, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Usaquén Historic Quarter", type: "property", price: 140, color: "#FF69B4", rent_site_only: 14, rent_one_house: 70, rent_two_houses: 200, rent_three_houses: 550, rent_four_houses: 750, rent_hotel: 950, cost_of_house: 100 },
  { name: "National Museum", type: "property", price: 160, color: "#FF69B4", rent_site_only: 16, rent_one_house: 80, rent_two_houses: 220, rent_three_houses: 600, rent_four_houses: 800, rent_hotel: 1000, cost_of_house: 100 },
  { name: "Trans-Andes Express", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Santa Marta Tourism Zone", type: "property", price: 180, color: "#FFA500", rent_site_only: 18, rent_one_house: 90, rent_two_houses: 250, rent_three_houses: 700, rent_four_houses: 875, rent_hotel: 1050, cost_of_house: 100 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#FFA500", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "El Dorado International Airport", type: "property", price: 180, color: "#FFA500", rent_site_only: 20, rent_one_house: 100, rent_two_houses: 300, rent_three_houses: 750, rent_four_houses: 925, rent_hotel: 1100, cost_of_house: 100 },
  { name: "Chapinero Uptown District", type: "property", price: 200, color: "#FFA500", rent_site_only: 22, rent_one_house: 110, rent_two_houses: 330, rent_three_houses: 800, rent_four_houses: 975, rent_hotel: 1150, cost_of_house: 100 },
  { name: "FREE PARKING", type: "corner", price: 0, color: "#3498db", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Buenaventura Port Zone", type: "property", price: 220, color: "#FF0000", rent_site_only: 24, rent_one_house: 120, rent_two_houses: 360, rent_three_houses: 850, rent_four_houses: 1025, rent_hotel: 1200, cost_of_house: 150 },
  { name: "CHANCE", type: "chance", price: 0, color: "#FF0000", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Bogotá Stock Exchange", type: "property", price: 220, color: "#FF0000", rent_site_only: 26, rent_one_house: 130, rent_two_houses: 390, rent_three_houses: 900, rent_four_houses: 1100, rent_hotel: 1300, cost_of_house: 150 },
  { name: "Universidad Nacional Campus", type: "property", price: 240, color: "#FF0000", rent_site_only: 28, rent_one_house: 150, rent_two_houses: 450, rent_three_houses: 1000, rent_four_houses: 1200, rent_hotel: 1400, cost_of_house: 150 },
  { name: "Pacific Railway Link", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Cali Salsa & Music District", type: "property", price: 260, color: "#FFD700", rent_site_only: 30, rent_one_house: 160, rent_two_houses: 480, rent_three_houses: 1100, rent_four_houses: 1300, rent_hotel: 1500, cost_of_house: 150 },
  { name: "Barranquilla Caribbean Hub", type: "property", price: 260, color: "#FFD700", rent_site_only: 32, rent_one_house: 170, rent_two_houses: 510, rent_three_houses: 1150, rent_four_houses: 1400, rent_hotel: 1600, cost_of_house: 150 },
  { name: "Cauca Power Corporation", type: "property", price: 150, color: "utility", rent_site_only: 4, rent_one_house: 10, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Bogotá Premium Central", type: "property", price: 280, color: "#FFD700", rent_site_only: 34, rent_one_house: 180, rent_two_houses: 540, rent_three_houses: 1200, rent_four_houses: 1500, rent_hotel: 1800, cost_of_house: 150 },
  { name: "GO TO JAIL", type: "corner", price: 0, color: "#e74c3c", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Tayrona National Park", type: "property", price: 300, color: "#228B22", rent_site_only: 36, rent_one_house: 200, rent_two_houses: 600, rent_three_houses: 1400, rent_four_houses: 1700, rent_hotel: 2000, cost_of_house: 200 },
  { name: "Cocora Valley Palms", type: "property", price: 300, color: "#228B22", rent_site_only: 38, rent_one_house: 220, rent_two_houses: 660, rent_three_houses: 1500, rent_four_houses: 1800, rent_hotel: 2200, cost_of_house: 200 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#228B22", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Colombian Metropolitan Zone", type: "property", price: 320, color: "#228B22", rent_site_only: 40, rent_one_house: 220, rent_two_houses: 660, rent_three_houses: 1600, rent_four_houses: 1900, rent_hotel: 2400, cost_of_house: 200 },
  { name: "Northern Caribbean Railway", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "CHANCE", type: "chance", price: 0, color: "#0000CD", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Bogotá Four Seasons District", type: "property", price: 350, color: "#0000CD", rent_site_only: 45, rent_one_house: 250, rent_two_houses: 700, rent_three_houses: 1500, rent_four_houses: 1800, rent_hotel: 2200, cost_of_house: 200 },
  { name: "LUXURY TAX", type: "luxury_tax", price: 0, color: "#0000CD", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Bogotá Gold Coast Premium", type: "property", price: 400, color: "#0000CD", rent_site_only: 50, rent_one_house: 300, rent_two_houses: 750, rent_three_houses: 2000, rent_four_houses: 2400, rent_hotel: 2800, cost_of_house: 200 },
];

export const seed = async (knex) => {
  // South Africa
  const saData = getPropertiesForBoard("south-africa", southAfricaProperties);
  await knex("properties").where({ board_id: "south-africa" }).del();
  for (const prop of saData) {
    await knex("properties").insert(prop);
  }
  console.log(`✓ Seeded ${saData.length} properties for South Africa`);

  // Colombia
  const colData = getPropertiesForBoard("colombia", colombiaProperties);
  await knex("properties").where({ board_id: "colombia" }).del();
  for (const prop of colData) {
    await knex("properties").insert(prop);
  }
  console.log(`✓ Seeded ${colData.length} properties for Colombia`);
};
