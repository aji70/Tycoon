/**
 * Scalability indexes for 100k+ DAUs and 200+ concurrent users.
 * See SCALABILITY_ANALYSIS.md and ANALYTICS_SUMMARY.md.
 */

export const up = async (knex) => {
  await knex.schema.alterTable("game_players", (table) => {
    table.index("game_id", "idx_game_players_game_id");
    table.index("user_id", "idx_game_players_user_id");
    table.index(["game_id", "user_id"], "idx_game_players_game_user");
  });

  await knex.schema.alterTable("games", (table) => {
    table.index("status", "idx_games_status");
    table.index("creator_id", "idx_games_creator_id");
  });

  await knex.schema.alterTable("game_properties", (table) => {
    table.index("game_id", "idx_game_properties_game_id");
    table.index("player_id", "idx_game_properties_player_id");
  });

  await knex.schema.alterTable("game_play_history", (table) => {
    table.index("game_id", "idx_game_play_history_game_id");
    table.index("game_player_id", "idx_game_play_history_player_id");
    table.index("created_at", "idx_game_play_history_created");
  });
};

export const down = async (knex) => {
  // MySQL: drop by index name
  await knex.raw("ALTER TABLE game_players DROP INDEX idx_game_players_game_id");
  await knex.raw("ALTER TABLE game_players DROP INDEX idx_game_players_user_id");
  await knex.raw("ALTER TABLE game_players DROP INDEX idx_game_players_game_user");

  await knex.raw("ALTER TABLE games DROP INDEX idx_games_status");
  await knex.raw("ALTER TABLE games DROP INDEX idx_games_creator_id");

  await knex.raw("ALTER TABLE game_properties DROP INDEX idx_game_properties_game_id");
  await knex.raw("ALTER TABLE game_properties DROP INDEX idx_game_properties_player_id");

  await knex.raw("ALTER TABLE game_play_history DROP INDEX idx_game_play_history_game_id");
  await knex.raw("ALTER TABLE game_play_history DROP INDEX idx_game_play_history_player_id");
  await knex.raw("ALTER TABLE game_play_history DROP INDEX idx_game_play_history_created");
};
