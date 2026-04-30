/**
 * Add ELO ranking and arena stats to user_agents table.
 * Enables Agent Arena discovery and ranking system.
 */

export const up = async (knex) => {
  await knex.schema.table("user_agents", (table) => {
    table.integer("elo_rating").defaultTo(1000).index(); // Current ELO
    table.integer("elo_peak").defaultTo(1000); // All-time peak
    table.integer("arena_wins").defaultTo(0); // Agent vs Agent wins
    table.integer("arena_losses").defaultTo(0); // Agent vs Agent losses
    table.integer("arena_draws").defaultTo(0); // Agent vs Agent draws
    table.boolean("is_public").defaultTo(false).index(); // Discoverable in arena
    table.text("total_prize_won_usdc").defaultTo("0"); // Big number as text (wei precision)
  });
};

export const down = async (knex) => {
  await knex.schema.table("user_agents", (table) => {
    table.dropColumn("elo_rating");
    table.dropColumn("elo_peak");
    table.dropColumn("arena_wins");
    table.dropColumn("arena_losses");
    table.dropColumn("arena_draws");
    table.dropColumn("is_public");
    table.dropColumn("total_prize_won_usdc");
  });
};
