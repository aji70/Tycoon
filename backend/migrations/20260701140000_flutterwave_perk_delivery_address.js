/**
 * Store the wallet address perks should be delivered to (connected MiniPay wallet at checkout).
 */
export async function up(knex) {
  const hasTable = await knex.schema.hasTable("flutterwave_perk_payments");
  if (!hasTable) return;
  const hasCol = await knex.schema.hasColumn("flutterwave_perk_payments", "delivery_address");
  if (!hasCol) {
    await knex.schema.alterTable("flutterwave_perk_payments", (table) => {
      table.string("delivery_address", 64).nullable();
    });
  }
}

export async function down(knex) {
  const hasTable = await knex.schema.hasTable("flutterwave_perk_payments");
  if (!hasTable) return;
  const hasCol = await knex.schema.hasColumn("flutterwave_perk_payments", "delivery_address");
  if (hasCol) {
    await knex.schema.alterTable("flutterwave_perk_payments", (table) => {
      table.dropColumn("delivery_address");
    });
  }
}
