/**
 * All Regional Board Properties
 * Kenya, South Africa, Indonesia, Philippines, Vietnam, Colombia, Brazil, Argentina
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

const kenyaProperties = [
  { name: "GO", type: "corner", price: 0, color: "#2ecc71", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Nairobi Central Business District", type: "property", price: 60, color: "#8B4513", rent_site_only: 2, rent_one_house: 10, rent_two_houses: 30, rent_three_houses: 90, rent_four_houses: 160, rent_hotel: 250, cost_of_house: 50 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#8B4513", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Karen Game Reserve", type: "property", price: 60, color: "#8B4513", rent_site_only: 4, rent_one_house: 20, rent_two_houses: 60, rent_three_houses: 180, rent_four_houses: 320, rent_hotel: 450, cost_of_house: 50 },
  { name: "INCOME TAX", type: "income_tax", price: 0, color: "#fff", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Kenya Railways", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Maasai Mara Lodge", type: "property", price: 100, color: "#87CEEB", rent_site_only: 6, rent_one_house: 30, rent_two_houses: 90, rent_three_houses: 270, rent_four_houses: 400, rent_hotel: 550, cost_of_house: 50 },
  { name: "CHANCE", type: "chance", price: 0, color: "#87CEEB", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Mount Kenya National Park", type: "property", price: 100, color: "#87CEEB", rent_site_only: 8, rent_one_house: 40, rent_two_houses: 100, rent_three_houses: 300, rent_four_houses: 450, rent_hotel: 600, cost_of_house: 50 },
  { name: "Mombasa Port City", type: "property", price: 120, color: "#87CEEB", rent_site_only: 10, rent_one_house: 50, rent_two_houses: 150, rent_three_houses: 450, rent_four_houses: 625, rent_hotel: 750, cost_of_house: 50 },
  { name: "JAIL/JUST VISITING", type: "corner", price: 0, color: "#7f8c8d", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Westlands Premium District", type: "property", price: 140, color: "#FF69B4", rent_site_only: 12, rent_one_house: 60, rent_two_houses: 180, rent_three_houses: 500, rent_four_houses: 700, rent_hotel: 900, cost_of_house: 100 },
  { name: "Nairobi Water Supply", type: "property", price: 150, color: "utility", rent_site_only: 4, rent_one_house: 10, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Kilimani Residential Zone", type: "property", price: 140, color: "#FF69B4", rent_site_only: 14, rent_one_house: 70, rent_two_houses: 200, rent_three_houses: 550, rent_four_houses: 750, rent_hotel: 950, cost_of_house: 100 },
  { name: "National Museum of Kenya", type: "property", price: 160, color: "#FF69B4", rent_site_only: 16, rent_one_house: 80, rent_two_houses: 220, rent_three_houses: 600, rent_four_houses: 800, rent_hotel: 1000, cost_of_house: 100 },
  { name: "East African Railway Express", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Diani Beach Commercial", type: "property", price: 180, color: "#FFA500", rent_site_only: 18, rent_one_house: 90, rent_two_houses: 250, rent_three_houses: 700, rent_four_houses: 875, rent_hotel: 1050, cost_of_house: 100 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#FFA500", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Kenyatta International Airport", type: "property", price: 180, color: "#FFA500", rent_site_only: 20, rent_one_house: 100, rent_two_houses: 300, rent_three_houses: 750, rent_four_houses: 925, rent_hotel: 1100, cost_of_house: 100 },
  { name: "Upper Hill Corporate Hub", type: "property", price: 200, color: "#FFA500", rent_site_only: 22, rent_one_house: 110, rent_two_houses: 330, rent_three_houses: 800, rent_four_houses: 975, rent_hotel: 1150, cost_of_house: 100 },
  { name: "FREE PARKING", type: "corner", price: 0, color: "#3498db", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Langata Investment Zone", type: "property", price: 220, color: "#FF0000", rent_site_only: 24, rent_one_house: 120, rent_two_houses: 360, rent_three_houses: 850, rent_four_houses: 1025, rent_hotel: 1200, cost_of_house: 150 },
  { name: "CHANCE", type: "chance", price: 0, color: "#FF0000", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Nairobi Stock Exchange", type: "property", price: 220, color: "#FF0000", rent_site_only: 26, rent_one_house: 130, rent_two_houses: 390, rent_three_houses: 900, rent_four_houses: 1100, rent_hotel: 1300, cost_of_house: 150 },
  { name: "University of Nairobi Campus", type: "property", price: 240, color: "#FF0000", rent_site_only: 28, rent_one_house: 150, rent_two_houses: 450, rent_three_houses: 1000, rent_four_houses: 1200, rent_hotel: 1400, cost_of_house: 150 },
  { name: "Standard Gauge Railway", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Nyaya Junction Commercial", type: "property", price: 260, color: "#FFD700", rent_site_only: 30, rent_one_house: 160, rent_two_houses: 480, rent_three_houses: 1100, rent_four_houses: 1300, rent_hotel: 1500, cost_of_house: 150 },
  { name: "Muthaiga Hill Residences", type: "property", price: 260, color: "#FFD700", rent_site_only: 32, rent_one_house: 170, rent_two_houses: 510, rent_three_houses: 1150, rent_four_houses: 1400, rent_hotel: 1600, cost_of_house: 150 },
  { name: "Kenya Power Company", type: "property", price: 150, color: "utility", rent_site_only: 4, rent_one_house: 10, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Prestige Nairobi East Premium", type: "property", price: 280, color: "#FFD700", rent_site_only: 34, rent_one_house: 180, rent_two_houses: 540, rent_three_houses: 1200, rent_four_houses: 1500, rent_hotel: 1800, cost_of_house: 150 },
  { name: "GO TO JAIL", type: "corner", price: 0, color: "#e74c3c", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Aberdare Forest Lodge", type: "property", price: 300, color: "#228B22", rent_site_only: 36, rent_one_house: 200, rent_two_houses: 600, rent_three_houses: 1400, rent_four_houses: 1700, rent_hotel: 2000, cost_of_house: 200 },
  { name: "Great Rift Valley Resort", type: "property", price: 300, color: "#228B22", rent_site_only: 38, rent_one_house: 220, rent_two_houses: 660, rent_three_houses: 1500, rent_four_houses: 1800, rent_hotel: 2200, cost_of_house: 200 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#228B22", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Nairobi Metropolitan Zone", type: "property", price: 320, color: "#228B22", rent_site_only: 40, rent_one_house: 220, rent_two_houses: 660, rent_three_houses: 1600, rent_four_houses: 1900, rent_hotel: 2400, cost_of_house: 200 },
  { name: "Uganda Railway Connection", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "CHANCE", type: "chance", price: 0, color: "#0000CD", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Safari Park Hotel District", type: "property", price: 350, color: "#0000CD", rent_site_only: 45, rent_one_house: 250, rent_two_houses: 700, rent_three_houses: 1500, rent_four_houses: 1800, rent_hotel: 2200, cost_of_house: 200 },
  { name: "LUXURY TAX", type: "luxury_tax", price: 0, color: "#0000CD", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Nairobi Gold Coast Premium", type: "property", price: 400, color: "#0000CD", rent_site_only: 50, rent_one_house: 300, rent_two_houses: 750, rent_three_houses: 2000, rent_four_houses: 2400, rent_hotel: 2800, cost_of_house: 200 },
];

const brazilProperties = [
  { name: "GO", type: "corner", price: 0, color: "#2ecc71", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Copacabana Beach", type: "property", price: 60, color: "#8B4513", rent_site_only: 2, rent_one_house: 10, rent_two_houses: 30, rent_three_houses: 90, rent_four_houses: 160, rent_hotel: 250, cost_of_house: 50 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#8B4513", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Amazonas Eco-Reserve", type: "property", price: 60, color: "#8B4513", rent_site_only: 4, rent_one_house: 20, rent_two_houses: 60, rent_three_houses: 180, rent_four_houses: 320, rent_hotel: 450, cost_of_house: 50 },
  { name: "INCOME TAX", type: "income_tax", price: 0, color: "#fff", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Brasil Railways", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Christ the Redeemer", type: "property", price: 100, color: "#87CEEB", rent_site_only: 6, rent_one_house: 30, rent_two_houses: 90, rent_three_houses: 270, rent_four_houses: 400, rent_hotel: 550, cost_of_house: 50 },
  { name: "CHANCE", type: "chance", price: 0, color: "#87CEEB", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Iguazu Falls Resort", type: "property", price: 100, color: "#87CEEB", rent_site_only: 8, rent_one_house: 40, rent_two_houses: 100, rent_three_houses: 300, rent_four_houses: 450, rent_hotel: 600, cost_of_house: 50 },
  { name: "Paulista Avenue Commercial", type: "property", price: 120, color: "#87CEEB", rent_site_only: 10, rent_one_house: 50, rent_two_houses: 150, rent_three_houses: 450, rent_four_houses: 625, rent_hotel: 750, cost_of_house: 50 },
  { name: "JAIL/JUST VISITING", type: "corner", price: 0, color: "#7f8c8d", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Ipanema Luxury District", type: "property", price: 140, color: "#FF69B4", rent_site_only: 12, rent_one_house: 60, rent_two_houses: 180, rent_three_houses: 500, rent_four_houses: 700, rent_hotel: 900, cost_of_house: 100 },
  { name: "Amazon Water Resources", type: "property", price: 150, color: "utility", rent_site_only: 4, rent_one_house: 10, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Leblon Beachfront", type: "property", price: 140, color: "#FF69B4", rent_site_only: 14, rent_one_house: 70, rent_two_houses: 200, rent_three_houses: 550, rent_four_houses: 750, rent_hotel: 950, cost_of_house: 100 },
  { name: "National Library of Brazil", type: "property", price: 160, color: "#FF69B4", rent_site_only: 16, rent_one_house: 80, rent_two_houses: 220, rent_three_houses: 600, rent_four_houses: 800, rent_hotel: 1000, cost_of_house: 100 },
  { name: "Trans-Brasil Express", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Santos Port Commercial", type: "property", price: 180, color: "#FFA500", rent_site_only: 18, rent_one_house: 90, rent_two_houses: 250, rent_three_houses: 700, rent_four_houses: 875, rent_hotel: 1050, cost_of_house: 100 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#FFA500", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Galeão International Airport", type: "property", price: 180, color: "#FFA500", rent_site_only: 20, rent_one_house: 100, rent_two_houses: 300, rent_three_houses: 750, rent_four_houses: 925, rent_hotel: 1100, cost_of_house: 100 },
  { name: "Guanabara Bay District", type: "property", price: 200, color: "#FFA500", rent_site_only: 22, rent_one_house: 110, rent_two_houses: 330, rent_three_houses: 800, rent_four_houses: 975, rent_hotel: 1150, cost_of_house: 100 },
  { name: "FREE PARKING", type: "corner", price: 0, color: "#3498db", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Salvador Colonial District", type: "property", price: 220, color: "#FF0000", rent_site_only: 24, rent_one_house: 120, rent_two_houses: 360, rent_three_houses: 850, rent_four_houses: 1025, rent_hotel: 1200, cost_of_house: 150 },
  { name: "CHANCE", type: "chance", price: 0, color: "#FF0000", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "São Paulo Stock Exchange", type: "property", price: 220, color: "#FF0000", rent_site_only: 26, rent_one_house: 130, rent_two_houses: 390, rent_three_houses: 900, rent_four_houses: 1100, rent_hotel: 1300, cost_of_house: 150 },
  { name: "University of São Paulo", type: "property", price: 240, color: "#FF0000", rent_site_only: 28, rent_one_house: 150, rent_two_houses: 450, rent_three_houses: 1000, rent_four_houses: 1200, rent_hotel: 1400, cost_of_house: 150 },
  { name: "Northeast Coast Railway", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Recife Carnival Zone", type: "property", price: 260, color: "#FFD700", rent_site_only: 30, rent_one_house: 160, rent_two_houses: 480, rent_three_houses: 1100, rent_four_houses: 1300, rent_hotel: 1500, cost_of_house: 150 },
  { name: "Belo Horizonte Park", type: "property", price: 260, color: "#FFD700", rent_site_only: 32, rent_one_house: 170, rent_two_houses: 510, rent_three_houses: 1150, rent_four_houses: 1400, rent_hotel: 1600, cost_of_house: 150 },
  { name: "Petrobras Energy Corp", type: "property", price: 150, color: "utility", rent_site_only: 4, rent_one_house: 10, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Manaus Amazon Premium", type: "property", price: 280, color: "#FFD700", rent_site_only: 34, rent_one_house: 180, rent_two_houses: 540, rent_three_houses: 1200, rent_four_houses: 1500, rent_hotel: 1800, cost_of_house: 150 },
  { name: "GO TO JAIL", type: "corner", price: 0, color: "#e74c3c", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Teresópolis Mountain Resort", type: "property", price: 300, color: "#228B22", rent_site_only: 36, rent_one_house: 200, rent_two_houses: 600, rent_three_houses: 1400, rent_four_houses: 1700, rent_hotel: 2000, cost_of_house: 200 },
  { name: "Lençóis Maranhenses Park", type: "property", price: 300, color: "#228B22", rent_site_only: 38, rent_one_house: 220, rent_two_houses: 660, rent_three_houses: 1500, rent_four_houses: 1800, rent_hotel: 2200, cost_of_house: 200 },
  { name: "COMMUNITY CHEST", type: "community_chest", price: 0, color: "#228B22", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Rio de Janeiro Metro Zone", type: "property", price: 320, color: "#228B22", rent_site_only: 40, rent_one_house: 220, rent_two_houses: 660, rent_three_houses: 1600, rent_four_houses: 1900, rent_hotel: 2400, cost_of_house: 200 },
  { name: "Southern Railway Hub", type: "property", price: 200, color: "railroad", rent_site_only: 25, rent_one_house: 50, rent_two_houses: 100, rent_three_houses: 200, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "CHANCE", type: "chance", price: 0, color: "#0000CD", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Fasano Luxury Tower District", type: "property", price: 350, color: "#0000CD", rent_site_only: 45, rent_one_house: 250, rent_two_houses: 700, rent_three_houses: 1500, rent_four_houses: 1800, rent_hotel: 2200, cost_of_house: 200 },
  { name: "LUXURY TAX", type: "luxury_tax", price: 0, color: "#0000CD", rent_site_only: 0, rent_one_house: 0, rent_two_houses: 0, rent_three_houses: 0, rent_four_houses: 0, rent_hotel: 0, cost_of_house: 0 },
  { name: "Rio Gold Coast Premium", type: "property", price: 400, color: "#0000CD", rent_site_only: 50, rent_one_house: 300, rent_two_houses: 750, rent_three_houses: 2000, rent_four_houses: 2400, rent_hotel: 2800, cost_of_house: 200 },
];

export const seed = async (knex) => {
  // Kenya
  const kenyaData = getPropertiesForBoard("kenya", kenyaProperties);
  await knex("properties").where({ board_id: "kenya" }).del();
  for (const prop of kenyaData) {
    await knex("properties").insert(prop);
  }
  console.log(`✓ Seeded ${kenyaData.length} properties for Kenya`);

  // Brazil
  const brazilData = getPropertiesForBoard("brazil", brazilProperties);
  await knex("properties").where({ board_id: "brazil" }).del();
  for (const prop of brazilData) {
    await knex("properties").insert(prop);
  }
  console.log(`✓ Seeded ${brazilData.length} properties for Brazil`);
};
