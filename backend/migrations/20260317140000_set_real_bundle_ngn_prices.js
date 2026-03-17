/**
 * Set real NGN prices for perk bundles (override old test 200 NGN).
 *
 * We derive NGN from USDC price using an approximate rate (same as frontend display):
 * 1 USDC ~= 1600 NGN.
 *
 * Only updates bundles that look like they still have the old testing price (<= 200).
 */
export async function up(knex) {
  const rate = 1600;

  // Update any active bundle with price_usdc set and price_ngn missing or still at test value (<= 200).
  // price_ngn stored as Naira, not kobo.
  await knex("perk_bundles")
    .where({ active: true })
    .andWhere((qb) => {
      qb.whereNull("price_ngn").orWhere("price_ngn", "<=", 200);
    })
    .andWhereNotNull("price_usdc")
    .update({
      price_ngn: knex.raw("ROUND(price_usdc * ?)", [rate]),
    });
}

export async function down(knex) {
  // Revert to null to avoid reintroducing the old test price.
  await knex("perk_bundles")
    .where({ active: true })
    .andWhere((qb) => {
      qb.where("price_ngn", ">=", 200);
    })
    .update({ price_ngn: null });
}

