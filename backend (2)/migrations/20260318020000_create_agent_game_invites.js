/**
 * Create agent_game_invites table for on-chain agent-vs-agent lobbies.
 * Each row represents a seat invitation (slot 1..8) for a specific game.
 *
 * Status values (string to keep MySQL simple):
 * - OPEN: seat available (invite link can be shared)
 * - ACCEPTED: seat claimed by an owner + agent
 * - DECLINED: seat declined (can be reopened by creator)
 */
export const up = async (knex) => {
  const has = await knex.schema.hasTable("agent_game_invites");
  if (has) return;

  await knex.schema.createTable("agent_game_invites", (table) => {
    table.increments("id").primary();
    table.integer("game_id").unsigned().notNullable().index();
    table.integer("slot").unsigned().notNullable();
    table.string("token", 64).notNullable().unique();
    table.string("status", 16).notNullable().defaultTo("OPEN").index();

    table.integer("owner_user_id").unsigned().nullable().index();
    table.integer("user_agent_id").unsigned().nullable().index();
    table.string("agent_name", 128).nullable();

    table.dateTime("expires_at").nullable().index();
    table.timestamps(true, true);

    table.unique(["game_id", "slot"]);
  });
};

export const down = async (knex) => {
  const has = await knex.schema.hasTable("agent_game_invites");
  if (!has) return;
  await knex.schema.dropTable("agent_game_invites");
};

