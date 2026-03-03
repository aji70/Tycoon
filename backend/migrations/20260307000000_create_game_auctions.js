/**
 * Auction unsold property: when a player declines to buy, property goes to auction.
 * game_auctions: one row per active/completed auction.
 * game_auction_bids: each player's bid (amount or pass).
 */

exports.up = function (knex) {
  return knex.schema
    .createTable("game_auctions", (table) => {
      table.increments("id").primary();
      table.integer("game_id").unsigned().notNullable().references("id").inTable("games").onDelete("CASCADE");
      table.integer("property_id").unsigned().notNullable().references("id").inTable("properties");
      table.integer("started_by_player_id").unsigned().notNullable().references("id").inTable("game_players").onDelete("CASCADE");
      table.enum("status", ["open", "closed"]).notNullable().defaultTo("open");
      table.integer("winner_player_id").unsigned().nullable().references("id").inTable("game_players").onDelete("SET NULL");
      table.integer("winning_amount").unsigned().nullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
    })
    .then(() =>
      knex.schema.createTable("game_auction_bids", (table) => {
        table.increments("id").primary();
        table.integer("auction_id").unsigned().notNullable().references("id").inTable("game_auctions").onDelete("CASCADE");
        table.integer("game_player_id").unsigned().notNullable().references("id").inTable("game_players").onDelete("CASCADE");
        table.integer("amount").unsigned().nullable(); // null = pass
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.unique(["auction_id", "game_player_id"]);
      })
    );
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("game_auction_bids").then(() => knex.schema.dropTableIfExists("game_auctions"));
};
