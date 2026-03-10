/**
 * Persist agent slot assignments so they survive server restart.
 * game_id = 0 means "global" slot (no specific game); otherwise game-specific.
 */

export const up = async (knex) => {
  await knex.schema.createTable("agent_slot_assignments", (table) => {
    table.increments("id").primary();
    table.integer("game_id").unsigned().notNullable().defaultTo(0).comment("0 = global slot, else game-specific");
    table.integer("slot").unsigned().notNullable().comment("1-8");
    table.integer("user_agent_id").unsigned().nullable();
    table.string("callback_url", 512).nullable();
    table.string("agent_id", 64).nullable();
    table.string("name", 128).nullable();
    table.integer("chain_id").unsigned().nullable().defaultTo(42220);
    table.timestamps(true, true);
    table.unique(["game_id", "slot"]);
    table.index("game_id");
    table.index("slot");
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("agent_slot_assignments");
};
