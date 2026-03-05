/**
 * Set shop bundle NGN price to ₦200 (Flutterwave minimum).
 */
export async function up(knex) {
  await knex("perk_bundles").where({ name: "Starter Pack" }).update({ price_ngn: 200 });
}

export async function down(knex) {
  await knex("perk_bundles").where({ name: "Starter Pack" }).update({ price_ngn: 50 });
}
