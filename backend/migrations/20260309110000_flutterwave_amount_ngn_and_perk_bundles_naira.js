/**
 * NGN prices in Naira (not kobo).
 * - flutterwave_payments: add amount_ngn (Naira); amount_kobo kept for backward compatibility.
 * - perk_bundles.price_ngn: now stored as Naira; optionally convert existing kobo values to Naira.
 */
export async function up(knex) {
  if (await knex.schema.hasTable("flutterwave_payments") && !(await knex.schema.hasColumn("flutterwave_payments", "amount_ngn"))) {
    await knex.schema.alterTable("flutterwave_payments", (table) => {
      table.decimal("amount_ngn", 12, 2).nullable().comment("Amount in Naira");
    });
  }

  // Convert existing perk_bundles.price_ngn from kobo to Naira (e.g. 5000 -> 50)
  const hasColumn = await knex.schema.hasColumn("perk_bundles", "price_ngn");
  if (hasColumn) {
    await knex.raw(
      "UPDATE perk_bundles SET price_ngn = FLOOR(price_ngn / 100) WHERE price_ngn IS NOT NULL AND price_ngn >= 100"
    );
  }
}

export async function down(knex) {
  if (await knex.schema.hasColumn("flutterwave_payments", "amount_ngn")) {
    await knex.schema.alterTable("flutterwave_payments", (table) => table.dropColumn("amount_ngn"));
  }
  // Note: reverting perk_bundles price_ngn back to kobo would require * 100; omitted for safety.
}
