/**
 * Add active_perks (JSON) and pending_exact_roll to game_players for perk effects.
 */

export const up = async (knex) => {
  const hasActivePerks = await knex.schema.hasColumn("game_players", "active_perks");
  if (!hasActivePerks) {
    await knex.schema.table("game_players", (table) => {
      table.text("active_perks").nullable();
    });
  }
  const hasPendingExactRoll = await knex.schema.hasColumn("game_players", "pending_exact_roll");
  if (!hasPendingExactRoll) {
    await knex.schema.table("game_players", (table) => {
      table.integer("pending_exact_roll").unsigned().nullable();
    });
  }
};

export const down = async (knex) => {
  if (await knex.schema.hasColumn("game_players", "active_perks")) {
    await knex.schema.table("game_players", (table) => table.dropColumn("active_perks"));
  }
  if (await knex.schema.hasColumn("game_players", "pending_exact_roll")) {
    await knex.schema.table("game_players", (table) => table.dropColumn("pending_exact_roll"));
  }
};
