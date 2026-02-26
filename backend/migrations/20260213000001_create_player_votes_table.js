/**
 * Player Votes Table
 * Tracks votes to remove inactive/timed-out players in multiplayer games.
 * When a player times out (90s) or has 3+ consecutive timeouts, other players can vote to remove them.
 * Removal happens when all other players vote (or 1 vote if only 2 players remain).
 */
export const up = (knex) => {
  return knex.schema.createTable("player_votes", (table) => {
    table.increments("id").primary();
    table.integer("game_id").unsigned().notNullable();
    table.integer("target_user_id").unsigned().notNullable(); // Player being voted out
    table.integer("voter_user_id").unsigned().notNullable(); // Player casting the vote
    table.timestamp("created_at").defaultTo(knex.fn.now());
    
    // Unique: one vote per voter per target per game
    table.unique(["game_id", "target_user_id", "voter_user_id"]);
    
    // Indexes for quick lookups
    table.index(["game_id", "target_user_id"]);
    table.index("created_at");
    
    // Foreign keys (optional, but good practice)
    table.foreign("game_id").references("games.id").onDelete("CASCADE");
  });
};

export const down = (knex) => {
  return knex.schema.dropTableIfExists("player_votes");
};
