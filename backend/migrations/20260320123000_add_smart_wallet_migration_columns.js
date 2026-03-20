/**
 * Track smart-wallet recreation migration state and legacy wallet.
 */
export const up = async (knex) => {
  const hasLegacy = await knex.schema.hasColumn("users", "legacy_smart_wallet_address");
  if (!hasLegacy) {
    await knex.schema.alterTable("users", (table) => {
      table.string("legacy_smart_wallet_address", 120).nullable();
    });
  }

  const hasStatus = await knex.schema.hasColumn("users", "smart_wallet_migration_status");
  if (!hasStatus) {
    await knex.schema.alterTable("users", (table) => {
      table.string("smart_wallet_migration_status", 32).nullable();
    });
  }

  const hasReport = await knex.schema.hasColumn("users", "smart_wallet_migration_report");
  if (!hasReport) {
    await knex.schema.alterTable("users", (table) => {
      table.text("smart_wallet_migration_report", "longtext").nullable();
    });
  }
};

export const down = async (knex) => {
  const hasLegacy = await knex.schema.hasColumn("users", "legacy_smart_wallet_address");
  const hasStatus = await knex.schema.hasColumn("users", "smart_wallet_migration_status");
  const hasReport = await knex.schema.hasColumn("users", "smart_wallet_migration_report");
  if (hasLegacy || hasStatus || hasReport) {
    await knex.schema.alterTable("users", (table) => {
      if (hasLegacy) table.dropColumn("legacy_smart_wallet_address");
      if (hasStatus) table.dropColumn("smart_wallet_migration_status");
      if (hasReport) table.dropColumn("smart_wallet_migration_report");
    });
  }
};
