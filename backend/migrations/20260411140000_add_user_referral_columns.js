/**
 * Referral attribution: unique code per user, optional referred_by link.
 */

import crypto from "crypto";

async function assignMissingCodes(knex) {
  const rows = await knex("users").select("id").whereNull("referral_code");
  for (const { id } of rows) {
    let assigned = false;
    for (let attempt = 0; attempt < 20 && !assigned; attempt++) {
      const code = `t${crypto.randomBytes(5).toString("hex")}`;
      try {
        await knex("users").where({ id }).update({ referral_code: code });
        assigned = true;
      } catch (e) {
        if (e.code !== "ER_DUP_ENTRY") throw e;
      }
    }
    if (!assigned) {
      throw new Error(`referral code backfill failed for user id ${id}`);
    }
  }
}

export async function up(knex) {
  const hasCode = await knex.schema.hasColumn("users", "referral_code");
  if (!hasCode) {
    await knex.schema.alterTable("users", (table) => {
      table.string("referral_code", 32).nullable().unique();
      table.integer("referred_by_user_id").unsigned().nullable();
      table.timestamp("referred_at").nullable();
      table.foreign("referred_by_user_id").references("id").inTable("users").onDelete("SET NULL");
    });
  }

  await assignMissingCodes(knex);
}

export async function down(knex) {
  const hasCode = await knex.schema.hasColumn("users", "referral_code");
  if (!hasCode) return;

  await knex.schema.alterTable("users", (table) => {
    table.dropForeign(["referred_by_user_id"]);
  });

  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("referral_code");
    table.dropColumn("referred_by_user_id");
    table.dropColumn("referred_at");
  });
}
