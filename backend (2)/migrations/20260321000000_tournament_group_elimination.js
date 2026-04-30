/**
 * Group elimination (2–4 players per table), spectator links, optional battle-royale notes column.
 */

export const up = async (knex) => {
  await knex.schema.table("tournament_matches", (table) => {
    table.json("participant_entry_ids").nullable();
    table.string("spectator_token", 32).nullable().unique();
    table.text("notes").nullable();
  });

  await knex.raw(
    "ALTER TABLE tournaments MODIFY COLUMN format ENUM('SINGLE_ELIMINATION','ROUND_ROBIN','SWISS','BATTLE_ROYALE','GROUP_ELIMINATION') NOT NULL DEFAULT 'SINGLE_ELIMINATION'"
  );
};

export const down = async (knex) => {
  await knex.schema.table("tournament_matches", (table) => {
    table.dropColumn("participant_entry_ids");
    table.dropColumn("spectator_token");
    table.dropColumn("notes");
  });

  await knex.raw(
    "ALTER TABLE tournaments MODIFY COLUMN format ENUM('SINGLE_ELIMINATION','ROUND_ROBIN','SWISS','BATTLE_ROYALE') NOT NULL DEFAULT 'SINGLE_ELIMINATION'"
  );
};
