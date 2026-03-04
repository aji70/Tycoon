/**
 * Seed additional perk bundles for the shop.
 */
export async function up(knex) {
  const existing = await knex("perk_bundles").select("name").pluck("name");
  const names = new Set(existing || []);

  const bundles = [
    {
      name: "Defender Pack",
      description: "Shield, Jail Free, and Roll Boost. Stay in the game when the board turns against you.",
      token_ids: JSON.stringify([]),
      amounts: JSON.stringify([]),
      price_tyc: 55,
      price_usdc: 2.75,
      active: true,
    },
    {
      name: "High Roller",
      description: "Double Rent, Roll Boost, and Exact Roll. Maximize income and land where it hurts.",
      token_ids: JSON.stringify([]),
      amounts: JSON.stringify([]),
      price_tyc: 65,
      price_usdc: 3.25,
      active: true,
    },
    {
      name: "Cash Flow",
      description: "Instant Cash, Property Discount, and Tax Refund (tiered). Keep your balance healthy.",
      token_ids: JSON.stringify([]),
      amounts: JSON.stringify([]),
      price_tyc: 70,
      price_usdc: 3.5,
      active: true,
    },
    {
      name: "Chaos Bundle",
      description: "Teleport, Exact Roll, and Lucky 7. Control the board and bend the dice.",
      token_ids: JSON.stringify([]),
      amounts: JSON.stringify([]),
      price_tyc: 75,
      price_usdc: 4,
      active: true,
    },
    {
      name: "Landlord's Choice",
      description: "Rent Cashback, Interest, and Free Parking Bonus. Rewards for property owners and patient play.",
      token_ids: JSON.stringify([]),
      amounts: JSON.stringify([]),
      price_tyc: 50,
      price_usdc: 2.5,
      active: true,
    },
  ];

  for (const b of bundles) {
    if (!names.has(b.name)) {
      await knex("perk_bundles").insert(b);
      names.add(b.name);
    }
  }
}

export async function down(knex) {
  const toRemove = [
    "Defender Pack",
    "High Roller",
    "Cash Flow",
    "Chaos Bundle",
    "Landlord's Choice",
  ];
  await knex("perk_bundles").whereIn("name", toRemove).del();
}
