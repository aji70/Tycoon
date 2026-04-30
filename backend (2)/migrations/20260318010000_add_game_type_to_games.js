/**
 * Add game_type to games table.
 *
 * game_type is used to distinguish gameplay orchestration:
 * - PVP_HUMAN: human vs human (existing)
 * - AI_HUMAN_VS_AI: human vs AI (existing "is_ai" games)
 * - AGENT_VS_AI: agent controls slot 1, AI/agents control slots 2..N
 * - AGENT_VS_AGENT: slots 1..N are agents (2..8 players)
 */
export const up = async (knex) => {
  await knex.schema.table("games", (table) => {
    // Use string (not enum) to keep MySQL migrations simple and forward-compatible.
    table.string("game_type", 32).nullable().index();
  });

  // Backfill existing rows to sane defaults.
  await knex("games")
    .whereNull("game_type")
    .update({
      game_type: knex.raw("CASE WHEN is_ai = 1 THEN 'AI_HUMAN_VS_AI' ELSE 'PVP_HUMAN' END"),
    });
};

export const down = async (knex) => {
  await knex.schema.table("games", (table) => {
    table.dropIndex(["game_type"]);
    table.dropColumn("game_type");
  });
};

