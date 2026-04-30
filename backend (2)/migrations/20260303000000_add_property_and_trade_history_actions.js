/**
 * Add action values for property actions and trade accept to game_play_history.action ENUM.
 * Used so buy, build, sell building, mortgage, unmortgage, sell to bank, and trade accept appear in action log.
 */
export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE game_play_history
    MODIFY COLUMN action ENUM(
      'land', 'railway', 'utility', 'community_chest', 'chance',
      'goto_jail', 'visiting_jail', 'start', 'free_packing', 'income_tax', 'luxury_tax',
      'stay_in_jail', 'use_get_out_of_jail_free',
      'PERK_ACTIVATED', 'PERK_TELEPORT', 'PERK_BURN_CASH',
      'property_action', 'trade_accept'
    ) NOT NULL
  `);
};

export const down = async (knex) => {
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
