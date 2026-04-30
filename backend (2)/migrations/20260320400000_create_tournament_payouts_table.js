/**
 * tournament_payouts — logs all USDC payout transfers from tournament escrow to smart wallets.
 * Used for tracking prize distribution, payout status, and dispute resolution.
 */

export const up = async (knex) => {
  await knex.schema.createTable("tournament_payouts", (table) => {
    table.increments("id").primary();

    table.integer("tournament_id").unsigned().notNullable().index();
    table.foreign("tournament_id").references("tournaments.id").onDelete("CASCADE");

    table.integer("user_id").unsigned().notNullable().index();
    table.foreign("user_id").references("users.id").onDelete("CASCADE");

    table.integer("user_agent_id").unsigned().nullable(); // If payout was for an agent in the tournament
    table.foreign("user_agent_id").references("user_agents.id").onDelete("SET NULL");

    table.string("smart_wallet_address", 255).notNullable(); // Recipient address
    table.string("amount_usdc", 255).notNullable(); // Big number as string (wei precision)
    table.integer("placement").notNullable(); // 1st, 2nd, 3rd, etc.

    table.enum("status", ["PENDING", "SENT", "FAILED", "CLAIMED"]).notNullable().defaultTo("PENDING").index();
    table.text("tx_hash").nullable(); // On-chain transaction hash if sent
    table.text("error_reason").nullable(); // If failed, why

    table.timestamp("sent_at").nullable();
    table.timestamp("claimed_at").nullable(); // If user claimed from escrow
    table.timestamps(true, true);

    table.index(["tournament_id", "status"]);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("tournament_payouts");
};
