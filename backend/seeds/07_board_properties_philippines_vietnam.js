/**
 * Philippines & Vietnam Board Properties
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

const philippinesProperties = [
  { name: "GO", type: "corner", price: 0, color: "#2ecc71", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Makati Business District", type: "property", price: 80, color: "#8B4513", rent_site_only: 4, rent_one_house: 20, rent_two_houses: 60, rent_three_houses: 180, rent_four_houses: 320, rent_hotel: 450, cost_of_house: 50 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#8B4513", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Boracay Island Paradise", type: "property", price: 80, color: "#8B4513", rent_site_only: 6, rent_one_house: 30, rent_two_houses: 90, rent_three_houses: 270, rent_four_houses: 400, rent_hotel: 550, cost_of_house: 50 },
  { name: "INCOME TAX", type: "income_tax", price: 0, color: "#fff", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Philippine Railways", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Palawan Paradise Zone", type: "property", price: 120, color: "#87CEEB", rent_site_only: 8, rent_one_house: 40, rent_two_houses: 100, rent_three_houses: 300, rent_four_houses: 450, rent_hotel: 600, cost_of_house: 50 },
  { name: "CHANCE", type: "chance", price: 0, color: "#87CEEB", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Siargao Surfing Hub", type: "property", price: 120, color: "#87CEEB", rent_site_only: 10, rent_one_house: 50, rent_two_houses: 150, rent_three_houses: 450, rent_four_houses: 625, rent_hotel: 750, cost_of_house: 50 },
  { name: "Cebu City Commercial", type: "property", price: 140, color: "#87CEEB", rent_site_only: 12, rent_one_house: 60, rent_two_houses: 180, rent_three_houses: 500, rent_four_houses: 700, rent_hotel: 900, cost_of_house: 50 },
  { name: "JAIL/JUST VISITING", type: "corner", price: 0, color: "#7f8c8d", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "BGC Taguig Metro", type: "property", price: 160, color: "#FF69B4", rent_site_only: 14, rent_one_house: 70, rent_two_houses: 200, rent_three_houses: 550, rent_four_houses: 750, rent_hotel: 950, cost_of_house: 100 },
  { name: "Laguna Water Resources", type: "property", price: 150, color: "utility", rent_site_only: 4, rent_one_house: 10, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Davao Growing City", type: "property", price: 160, color: "#FF69B4", rent_site_only: 16, rent_one_house: 80, rent_two_houses: 220, rent_three_houses: 600, rent_four_houses: 800, rent_hotel: 1000, cost_of_house: 100 },
  { name: "National Museum", type: "property", price: 180, color: "#FF69B4", rent_site_only: 18, rent_one_house: 90, rent_two_houses: 250, rent_three_houses: 700, rent_four_houses: 875, rent_hotel: 1050, cost_of_house: 100 },
  { name: "Visayas Express Railway", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Subic Bay Free Port", type: "property", price: 200, color: "#FFA500", rent_site_only: 20, rent_one_house: 100, rent_two_houses: 300, rent_three_houses: 750, rent_four_houses: 925, rent_hotel: 1100, cost_of_house: 100 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#FFA500", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Ninoy Aquino Airport", type: "property", price: 200, color: "#FFA500", rent_site_only: 22, rent_one_house: 110, rent_two_houses: 330, rent_three_houses: 800, rent_four_houses: 975, rent_hotel: 1150, cost_of_house: 100 },
  { name: "Ermita Heritage Zone", type: "property", price: 220, color: "#FFA500", rent_site_only: 24, rent_one_house: 120, rent_two_houses: 360, rent_three_houses: 850, rent_four_houses: 1025, rent_hotel: 1200, cost_of_house: 100 },
  { name: "FREE PARKING", type: "corner", price: 0, color: "#3498db", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Mindanao Resource Zone", type: "property", price: 240, color: "#FF0000", rent_site_only: 26, rent_one_house: 130, rent_two_houses: 390, rent_three_houses: 900, rent_four_houses: 1100, rent_hotel: 1300, cost_of_house: 150 },
  { name: "CHANCE", type: "chance", price: 0, color: "#FF0000", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Philippine Stock Exchange", type: "property", price: 240, color: "#FF0000", rent_site_only: 28, rent_one_house: 150, rent_two_houses: 450, rent_three_houses: 1000, rent_four_houses: 1200, rent_hotel: 1400, cost_of_house: 150 },
  { name: "Ateneo de Manila University", type: "property", price: 260, color: "#FF0000", rent_site_only: 30, rent_one_house: 160, rent_two_houses: 480, rent_three_houses: 1100, rent_four_houses: 1300, rent_hotel: 1500, cost_of_house: 150 },
  { name: "Mindoro Express Railway", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Dumaguete Beach Resort", type: "property", price: 280, color: "#FFD700", rent_site_only: 32, rent_one_house: 170, rent_two_houses: 510, rent_three_houses: 1150, rent_four_houses: 1400, rent_hotel: 1600, cost_of_house: 150 },
  { name: "Puerto Princesa Heritage", type: "property", price: 280, color: "#FFD700", rent_site_only: 34, rent_one_house: 180, rent_two_houses: 540, rent_three_houses: 1200, rent_four_houses: 1500, rent_hotel: 1800, cost_of_house: 150 },
  { name: "Manila Water Authority", type: "property", price: 150, color: "utility", rent_site_only: 4, rent_one_house: 10, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Manila Gold Coast Zone", type: "property", price: 300, color: "#FFD700", rent_site_only: 36, rent_one_house: 200, rent_two_houses: 600, rent_three_houses: 1400, rent_four_houses: 1700, rent_hotel: 2000, cost_of_house: 150 },
  { name: "GO TO JAIL", type: "corner", price: 0, color: "#e74c3c", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Apo Island Diving Haven", type: "property", price: 320, color: "#228B22", rent_site_only: 38, rent_one_house: 220, rent_two_houses: 660, rent_three_houses: 1500, rent_four_houses: 1800, rent_hotel: 2200, cost_of_house: 200 },
  { name: "Banaue Rice Terraces", type: "property", price: 320, color: "#228B22", rent_site_only: 40, rent_one_house: 220, rent_two_houses: 660, rent_three_houses: 1600, rent_four_houses: 1900, rent_hotel: 2400, cost_of_house: 200 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#228B22", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Philippine Metropolitan", type: "property", price: 340, color: "#228B22", rent_site_only: 42, rent_one_house: 230, rent_two_houses: 690, rent_three_houses: 1650, rent_four_houses: 2000, rent_hotel: 2600, cost_of_house: 200 },
  { name: "Luzon Regional Railway", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "CHANCE", type: "chance", price: 0, color: "#0000CD", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Manila Luxury Towers", type: "property", price: 360, color: "#0000CD", rent_site_only: 45, rent_one_house: 250, rent_two_houses: 700, rent_three_houses: 1500, rent_four_houses: 1800, rent_hotel: 2200, cost_of_house: 200 },
  { name: "LUXURY TAX", type: "luxury_tax", price: 0, color: "#0000CD", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Manila Gold Coast Elite", type: "property", price: 420, color: "#0000CD", rent_site_only: 50, rent_one_house: 300, rent_two_houses: 750, rent_three_houses: 2000, rent_four_houses: 2400, rent_hotel: 2800, cost_of_house: 200 },
];

const vietnamProperties = [
  { name: "GO", type: "corner", price: 0, color: "#2ecc71", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Ho Chi Minh City CBD", type: "property", price: 60, color: "#8B4513", rent_site_only: 2, rent_one_house: 10, rent_two_houses: 30, rent_three_houses: 90, rent_four_houses: 160, rent_hotel: 250, cost_of_house: 50 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#8B4513", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Hanoi Ancient Capital", type: "property", price: 60, color: "#8B4513", rent_site_only: 4, rent_one_house: 20, rent_two_houses: 60, rent_three_houses: 180, rent_four_houses: 320, rent_hotel: 450, cost_of_house: 50 },
  { name: "INCOME TAX", type: "income_tax", price: 0, color: "#fff", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Vietnamese Railways", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Ha Long Bay Cruise Zone", type: "property", price: 100, color: "#87CEEB", rent_site_only: 6, rent_one_house: 30, rent_two_houses: 90, rent_three_houses: 270, rent_four_houses: 400, rent_hotel: 550, cost_of_house: 50 },
  { name: "CHANCE", type: "chance", price: 0, color: "#87CEEB", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Sapa Mountain Trekking", type: "property", price: 100, color: "#87CEEB", rent_site_only: 8, rent_one_house: 40, rent_two_houses: 100, rent_three_houses: 300, rent_four_houses: 450, rent_hotel: 600, cost_of_house: 50 },
  { name: "Da Nang Beach City", type: "property", price: 120, color: "#87CEEB", rent_site_only: 10, rent_one_house: 50, rent_two_houses: 150, rent_three_houses: 450, rent_four_houses: 625, rent_hotel: 750, cost_of_house: 50 },
  { name: "JAIL/JUST VISITING", type: "corner", price: 0, color: "#7f8c8d", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "District 1 Premium Zone", type: "property", price: 140, color: "#FF69B4", rent_site_only: 12, rent_one_house: 60, rent_two_houses: 180, rent_three_houses: 500, rent_four_houses: 700, rent_hotel: 900, cost_of_house: 100 },
  { name: "Red River Water Authority", type: "property", price: 150, color: "utility", rent_site_only: 4, rent_one_house: 10, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Hue Imperial City", type: "property", price: 140, color: "#FF69B4", rent_site_only: 14, rent_one_house: 70, rent_two_houses: 200, rent_three_houses: 550, rent_four_houses: 750, rent_hotel: 950, cost_of_house: 100 },
  { name: "War Remnants Museum", type: "property", price: 160, color: "#FF69B4", rent_site_only: 16, rent_one_house: 80, rent_two_houses: 220, rent_three_houses: 600, rent_four_houses: 800, rent_hotel: 1000, cost_of_house: 100 },
  { name: "Mekong Express Railway", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Nha Trang Beach Zone", type: "property", price: 180, color: "#FFA500", rent_site_only: 18, rent_one_house: 90, rent_two_houses: 250, rent_three_houses: 700, rent_four_houses: 875, rent_hotel: 1050, cost_of_house: 100 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#FFA500", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Tan Son Nhat Airport", type: "property", price: 180, color: "#FFA500", rent_site_only: 20, rent_one_house: 100, rent_two_houses: 300, rent_three_houses: 750, rent_four_houses: 925, rent_hotel: 1100, cost_of_house: 100 },
  { name: "Hanoi Downtown Elite", type: "property", price: 200, color: "#FFA500", rent_site_only: 22, rent_one_house: 110, rent_two_houses: 330, rent_three_houses: 800, rent_four_houses: 975, rent_hotel: 1150, cost_of_house: 100 },
  { name: "FREE PARKING", type: "corner", price: 0, color: "#3498db", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Mekong Delta Rural Zone", type: "property", price: 220, color: "#FF0000", rent_site_only: 24, rent_one_house: 120, rent_two_houses: 360, rent_three_houses: 850, rent_four_houses: 1025, rent_hotel: 1200, cost_of_house: 150 },
  { name: "CHANCE", type: "chance", price: 0, color: "#FF0000", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Ho Chi Minh Stock Exchange", type: "property", price: 220, color: "#FF0000", rent_site_only: 26, rent_one_house: 130, rent_two_houses: 390, rent_three_houses: 900, rent_four_houses: 1100, rent_hotel: 1300, cost_of_house: 150 },
  { name: "Vietnam National University", type: "property", price: 240, color: "#FF0000", rent_site_only: 28, rent_one_house: 150, rent_two_houses: 450, rent_three_houses: 1000, rent_four_houses: 1200, rent_hotel: 1400, cost_of_house: 150 },
  { name: "Trans-Indochina Railway", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Quy Nhon Coastal Zone", type: "property", price: 260, color: "#FFD700", rent_site_only: 30, rent_one_house: 160, rent_two_houses: 480, rent_three_houses: 1100, rent_four_houses: 1300, rent_hotel: 1500, cost_of_house: 150 },
  { name: "Phu Quoc Island Resort", type: "property", price: 260, color: "#FFD700", rent_site_only: 32, rent_one_house: 170, rent_two_houses: 510, rent_three_houses: 1150, rent_four_houses: 1400, rent_hotel: 1600, cost_of_house: 150 },
  { name: "EVN Power Corporation", type: "property", price: 150, color: "utility", rent_site_only: 4, rent_one_house: 10, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "HCMC Gold Coast Premium", type: "property", price: 280, color: "#FFD700", rent_site_only: 34, rent_one_house: 180, rent_two_houses: 540, rent_three_houses: 1200, rent_four_houses: 1500, rent_hotel: 1800, cost_of_house: 150 },
  { name: "GO TO JAIL", type: "corner", price: 0, color: "#e74c3c", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Cat Ba Adventure Lodge", type: "property", price: 300, color: "#228B22", rent_site_only: 36, rent_one_house: 200, rent_two_houses: 600, rent_three_houses: 1400, rent_four_houses: 1700, rent_hotel: 2000, cost_of_house: 200 },
  { name: "Phong Nha Karst Cave", type: "property", price: 300, color: "#228B22", rent_site_only: 38, rent_one_house: 220, rent_two_houses: 660, rent_three_houses: 1500, rent_four_houses: 1800, rent_hotel: 2200, cost_of_house: 200 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#228B22", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Vietnamese Metropolitan", type: "property", price: 320, color: "#228B22", rent_site_only: 40, rent_one_house: 220, rent_two_houses: 660, rent_three_houses: 1600, rent_four_houses: 1900, rent_hotel: 2400, cost_of_house: 200 },
  { name: "Northern Regional Railway", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "CHANCE", type: "chance", price: 0, color: "#0000CD", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Park Hyatt HCMC District", type: "property", price: 350, color: "#0000CD", rent_site_only: 45, rent_one_house: 250, rent_two_houses: 700, rent_three_houses: 1500, rent_four_houses: 1800, rent_hotel: 2200, cost_of_house: 200 },
  { name: "LUXURY TAX", type: "luxury_tax", price: 0, color: "#0000CD", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Ho Chi Minh Gold Coast", type: "property", price: 400, color: "#0000CD", rent_site_only: 50, rent_one_house: 300, rent_two_houses: 750, rent_three_houses: 2000, rent_four_houses: 2400, rent_hotel: 2800, cost_of_house: 200 },
];

export const seed = async (knex) => {
  // Philippines
  const phData = getPropertiesForBoard("philippines", philippinesProperties);
  await knex("properties").where({ board_id: "philippines" }).del();
  for (const prop of phData) {
    await knex("properties").insert(prop);
  }
  console.log(`✓ Seeded ${phData.length} properties for Philippines`);

  // Vietnam
  const vnData = getPropertiesForBoard("vietnam", vietnamProperties);
  await knex("properties").where({ board_id: "vietnam" }).del();
  for (const prop of vnData) {
    await knex("properties").insert(prop);
  }
  console.log(`✓ Seeded ${vnData.length} properties for Vietnam`);
};
