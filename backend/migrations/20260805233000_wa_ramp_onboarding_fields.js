/**
 * Onboarding profile fields for WhatsApp ramp users.
 */

export const up = async (knex) => {
  const has = await knex.schema.hasTable("wa_ramp_users");
  if (!has) return;

  const addIfMissing = async (col, builder) => {
    const exists = await knex.schema.hasColumn("wa_ramp_users", col);
    if (!exists) {
      await knex.schema.alterTable("wa_ramp_users", builder);
    }
  };

  await addIfMissing("username", (t) => t.string("username", 64).nullable());
  await addIfMissing("email", (t) => t.string("email", 160).nullable());
  await addIfMissing("pin_hash", (t) => t.string("pin_hash", 100).nullable());
  await addIfMissing("pin_setup_hash", (t) => t.string("pin_setup_hash", 100).nullable());
  await addIfMissing("onboarding_step", (t) => t.string("onboarding_step", 32).nullable());
  await addIfMissing("onboarded_at", (t) => t.timestamp("onboarded_at").nullable());
  await addIfMissing("whatsapp_name", (t) => t.string("whatsapp_name", 128).nullable());
};

export const down = async (knex) => {
  if (!(await knex.schema.hasTable("wa_ramp_users"))) return;
  const cols = [
    "username",
    "email",
    "pin_hash",
    "pin_setup_hash",
    "onboarding_step",
    "onboarded_at",
    "whatsapp_name",
  ];
  for (const col of cols) {
    if (await knex.schema.hasColumn("wa_ramp_users", col)) {
      await knex.schema.alterTable("wa_ramp_users", (t) => t.dropColumn(col));
    }
  }
};
