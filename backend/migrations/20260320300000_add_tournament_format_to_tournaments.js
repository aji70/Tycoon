/**
 * Add tournament format, agent-only flag, and season fields to tournaments table.
 * Enables multiple bracket styles and agent-exclusive tournaments.
 */

export const up = async (knex) => {
  await knex.schema.table("tournaments", (table) => {
    table
      .enum("format", ["SINGLE_ELIMINATION", "ROUND_ROBIN", "SWISS", "BATTLE_ROYALE"])
      .defaultTo("SINGLE_ELIMINATION")
      .index();
    table.boolean("is_agent_only").defaultTo(false).index(); // Only agents allowed, no human players
    table.integer("season").nullable().index(); // Season number (optional grouping)
  });
};

export const down = async (knex) => {
  await knex.schema.table("tournaments", (table) => {
    table.dropColumn("format");
    table.dropColumn("is_agent_only");
    table.dropColumn("season");
  });
};
