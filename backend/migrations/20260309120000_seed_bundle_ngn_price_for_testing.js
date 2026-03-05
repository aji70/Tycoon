/**
 * Set one bundle to ₦50 NGN for payment testing (Flutterwave/Paystack).
 */
export async function up(knex) {
  await knex("perk_bundles").where({ name: "Starter Pack" }).update({ price_ngn: 50 });
}

export async function down(knex) {
  await knex("perk_bundles").where({ name: "Starter Pack" }).update({ price_ngn: null });
}
