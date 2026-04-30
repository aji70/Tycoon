/**
 * Tournament tables: tournaments, tournament_entries, tournament_rounds, tournament_matches.
 * Supports NO_POOL, ENTRY_FEE_POOL, CREATOR_FUNDED; backend-driven match lifecycle; leaderboard from bracket.
 */
export const up = async (knex) => {
  await knex.schema.createTable("tournaments", (table) => {
    table.increments("id").primary();
    table.integer("creator_id").unsigned().notNullable();
    table.string("name", 200).notNullable();
    table
      .enu("status", ["REGISTRATION_OPEN", "BRACKET_LOCKED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
      .notNullable()
      .defaultTo("REGISTRATION_OPEN");
    table
      .enu("prize_source", ["NO_POOL", "ENTRY_FEE_POOL", "CREATOR_FUNDED"])
      .notNullable()
      .defaultTo("NO_POOL");
    table.integer("max_players").unsigned().notNullable();
    table.integer("min_players").unsigned().notNullable().defaultTo(2);
    table.decimal("entry_fee_wei", 30, 0).notNullable().defaultTo(0);
    table.decimal("prize_pool_wei", 30, 0).nullable();
    table.json("prize_distribution").nullable(); // e.g. { "1": 50, "2": 30, "3": 15, "4": 5 }
    table.timestamp("registration_deadline").nullable();
    table.string("chain", 50).notNullable().defaultTo("BASE");
    table.timestamps(true, true);
    table.foreign("creator_id").references("users.id");
  });

  await knex.schema.createTable("tournament_entries", (table) => {
    table.increments("id").primary();
    table.integer("tournament_id").unsigned().notNullable();
    table.integer("user_id").unsigned().notNullable();
    table.string("address", 120).nullable(); // denormalized for quick lookup / duplicate check
    table.string("chain", 50).nullable();
    table.integer("seed_order").unsigned().nullable();
    table.string("payment_tx_hash", 100).nullable();
    table.enu("status", ["REGISTERED", "CONFIRMED", "DISQUALIFIED"]).notNullable().defaultTo("REGISTERED");
    table.timestamps(true, true);
    table.foreign("tournament_id").references("tournaments.id").onDelete("CASCADE");
    table.foreign("user_id").references("users.id");
    table.unique(["tournament_id", "user_id"]);
    table.index(["tournament_id", "address"]);
  });

  await knex.schema.createTable("tournament_rounds", (table) => {
    table.increments("id").primary();
    table.integer("tournament_id").unsigned().notNullable();
    table.integer("round_index").unsigned().notNullable(); // 0-based
    table
      .enu("status", ["PENDING", "IN_PROGRESS", "COMPLETED"])
      .notNullable()
      .defaultTo("PENDING");
    table.timestamp("started_at").nullable();
    table.timestamp("completed_at").nullable();
    table.timestamps(true, true);
    table.foreign("tournament_id").references("tournaments.id").onDelete("CASCADE");
    table.unique(["tournament_id", "round_index"]);
  });

  await knex.schema.createTable("tournament_matches", (table) => {
    table.increments("id").primary();
    table.integer("tournament_id").unsigned().notNullable();
    table.integer("round_index").unsigned().notNullable();
    table.integer("match_index").unsigned().notNullable(); // index within the round
    table.enu("slot_a_type", ["ENTRY", "MATCH_WINNER", "BYE"]).notNullable().defaultTo("ENTRY");
    table.integer("slot_a_entry_id").unsigned().nullable();
    table.integer("slot_a_prev_match_id").unsigned().nullable();
    table.enu("slot_b_type", ["ENTRY", "MATCH_WINNER", "BYE"]).notNullable().defaultTo("ENTRY");
    table.integer("slot_b_entry_id").unsigned().nullable();
    table.integer("slot_b_prev_match_id").unsigned().nullable();
    table.integer("game_id").unsigned().nullable(); // FK games.id
    table.string("contract_game_id", 78).nullable();
    table.integer("winner_entry_id").unsigned().nullable();
    table
      .enu("status", ["PENDING", "AWAITING_PLAYERS", "IN_PROGRESS", "COMPLETED", "BYE"])
      .notNullable()
      .defaultTo("PENDING");
    table.timestamps(true, true);
    table.foreign("tournament_id").references("tournaments.id").onDelete("CASCADE");
    table.foreign("slot_a_entry_id").references("tournament_entries.id");
    table.foreign("slot_b_entry_id").references("tournament_entries.id");
    table.foreign("winner_entry_id").references("tournament_entries.id");
    table.foreign("game_id").references("games.id");
    table.unique(["tournament_id", "round_index", "match_index"]);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("tournament_matches");
  await knex.schema.dropTableIfExists("tournament_rounds");
  await knex.schema.dropTableIfExists("tournament_entries");
  await knex.schema.dropTableIfExists("tournaments");
};
