/**
 * Add missing action values to game_play_history.action ENUM.
 * Code uses: stay_in_jail, use_get_out_of_jail_free, PERK_ACTIVATED, PERK_TELEPORT, PERK_BURN_CASH.
 */
export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE game_play_history
    MODIFY COLUMN action ENUM(
      'land', 'railway', 'utility', 'community_chest', 'chance',
      'goto_jail', 'visiting_jail', 'start', 'free_packing', 'income_tax', 'luxury_tax',
      'stay_in_jail', 'use_get_out_of_jail_free',
      'PERK_ACTIVATED', 'PERK_TELEPORT', 'PERK_BURN_CASH'
    ) NOT NULL
  `);
};

export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE game_play_history
    MODIFY COLUMN action ENUM(
      'land', 'railway', 'utility', 'community_chest', 'chance',
      'goto_jail', 'visiting_jail', 'start', 'free_packing', 'income_tax', 'luxury_tax'
    ) NOT NULL
  `);
};
