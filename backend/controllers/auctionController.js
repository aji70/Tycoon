import db from "../config/database.js";
import GamePlayer from "../models/GamePlayer.js";
import { invalidateGameById } from "../utils/gameCache.js";
import { emitGameUpdateByGameId } from "../utils/socketHelpers.js";
import logger from "../config/logger.js";

/**
 * Get active auction for a game (status = open). Returns null if none.
 */
export async function getActiveByGameId(gameId) {
  return db.transaction(async (trx) => {
    const row = await trx("game_auctions").where({ game_id: gameId, status: "open" }).first();
    if (!row) return null;

    const [bids, property, startedBy, players] = await Promise.all([
      trx("game_auction_bids as b")
        .join("game_players as p", "b.game_player_id", "p.id")
        .where("b.auction_id", row.id)
        .select("b.id", "b.game_player_id", "b.amount", "p.user_id", "p.address"),
      trx("properties").where({ id: row.property_id }).first(),
      trx("game_players").where({ id: row.started_by_player_id }).first(),
      trx("game_players").where({ game_id: gameId }).orderBy("turn_order", "asc")
        .select("id", "user_id", "address", "chance_jail_card", "community_chest_jail_card",
          "balance", "position", "turn_order", "symbol", "rolls", "rolled", "circle",
          "in_jail", "in_jail_rolls", "turn_start", "consecutive_timeouts", "turn_count",
          "active_perks", "pending_exact_roll", "created_at"),
    ]);

    const turnOrder = players.map((p) => p.id);
    const bidderIds = new Set(bids.map((b) => b.game_player_id));
    const nextBidderId = turnOrder.find((id) => !bidderIds.has(id)) ?? null;

    return {
      id: row.id,
      game_id: row.game_id,
      property_id: row.property_id,
      property,
      started_by_player_id: row.started_by_player_id,
      started_by: startedBy,
      status: row.status,
      bids: bids.map((b) => ({ game_player_id: b.game_player_id, user_id: b.user_id, address: b.address, amount: b.amount })),
      current_high: bids.reduce((max, b) => (b.amount != null && (max == null || b.amount > max) ? b.amount : max), null),
      next_bidder_player_id: nextBidderId,
      players,
    };
  });
}

/**
 * Resolve auction: assign property to winner (or leave unowned), deduct balance, close auction, advance turn.
 */
async function resolveAuction(req, auctionId) {
  const auction = await db("game_auctions").where({ id: auctionId }).first();
  if (!auction || auction.status !== "open") return;
  const gameId = auction.game_id;
  const bids = await db("game_auction_bids").where({ auction_id: auctionId });
  const withAmount = bids.filter((b) => b.amount != null);
  // Tie-breaker: equal highest bids → first highest bidder wins (see doc/auction-edge-cases.md)
  const winnerBid = withAmount.length > 0 ? withAmount.reduce((best, b) => (b.amount > (best?.amount ?? 0) ? b : best), null) : null;

  await db.transaction(async (trx) => {
    if (winnerBid) {
      const winner = await trx("game_players").where({ id: winnerBid.game_player_id }).first();
      const property = await trx("properties").where({ id: auction.property_id }).first();
      if (winner && property) {
        await trx("game_players").where({ id: winner.id }).update({
          balance: Number(winner.balance) - Number(winnerBid.amount),
          updated_at: db.fn.now(),
        });
        await trx("game_properties").insert({
          game_id: gameId,
          property_id: auction.property_id,
          player_id: winner.id,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        });
        await trx("game_play_history").insert({
          game_id: gameId,
          game_player_id: winner.id,
          rolled: null,
          old_position: null,
          new_position: null,
          action: "property_action",
          amount: -Number(winnerBid.amount),
          extra: null,
          comment: `won auction for ${property.name} with $${winnerBid.amount}`,
          active: 1,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        });
      }
    }
    await trx("game_auctions").where({ id: auctionId }).update({
      status: "closed",
      winner_player_id: winnerBid?.game_player_id ?? null,
      winning_amount: winnerBid?.amount ?? null,
    });

    const game = await trx("games").where({ id: gameId }).forUpdate().first();
    const players = await trx("game_players").where({ game_id: gameId }).orderBy("turn_order", "asc");
    const declinerIdx = players.findIndex((p) => p.id === auction.started_by_player_id);
    const nextIdx = declinerIdx >= 0 && declinerIdx < players.length - 1 ? declinerIdx + 1 : 0;
    const nextPlayer = players[nextIdx];
    const now = new Date();
    await trx("game_players").where({ game_id: gameId, id: auction.started_by_player_id }).update({ rolled: null, updated_at: now });
    await trx("games").where({ id: gameId }).update({ next_player_id: nextPlayer.user_id, updated_at: now });
    const turnStartSeconds = String(Math.floor(Date.now() / 1000));
    await trx("game_players").where({ game_id: gameId, user_id: nextPlayer.user_id }).update({ turn_start: turnStartSeconds, updated_at: now });
  });

  try {
    const io = req.app.get("io");
    if (io && gameId) await emitGameUpdateByGameId(io, gameId);
    await invalidateGameById(gameId);
  } catch (_) {}
}

/**
 * POST /games/auction/bid
 * Body: { game_id, auction_id, user_id, amount } (amount null or omit = pass)
 */
export async function placeBid(req, res) {
  try {
    const { game_id, auction_id, user_id, amount } = req.body;
    const trx = await db.transaction();
    try {
      const auction = await trx("game_auctions").where({ id: auction_id, game_id, status: "open" }).first();
      if (!auction) {
        await trx.rollback();
        return res.status(422).json({ success: false, message: "Auction not found or closed" });
      }
      const players = await trx("game_players").where({ game_id }).orderBy("turn_order", "asc");
      const existingBids = await trx("game_auction_bids").where({ auction_id });
      const bidderIds = new Set(existingBids.map((b) => b.game_player_id));
      const turnOrder = players.map((p) => p.id);
      const nextBidderId = turnOrder.find((id) => !bidderIds.has(id));
      const currentPlayer = players.find((p) => p.user_id === user_id);
      if (!currentPlayer) {
        await trx.rollback();
        return res.status(422).json({ success: false, message: "Player not in game" });
      }
      if (currentPlayer.id !== nextBidderId) {
        await trx.rollback();
        return res.status(422).json({ success: false, message: "Not your turn to bid" });
      }
      const currentHigh = existingBids.reduce((max, b) => (b.amount != null && (max == null || b.amount > max) ? b.amount : max), null);
      const bidAmount = amount != null && amount !== "" ? Number(amount) : null;
      if (bidAmount != null) {
        if (bidAmount <= (currentHigh ?? 0)) {
          await trx.rollback();
          return res.status(422).json({ success: false, message: "Bid must be higher than current high" });
        }
        if (Number(currentPlayer.balance) < bidAmount) {
          await trx.rollback();
          return res.status(422).json({ success: false, message: "Insufficient balance" });
        }
      }
      await trx("game_auction_bids").insert({
        auction_id,
        game_player_id: currentPlayer.id,
        amount: bidAmount,
      });
      await trx.commit();
    } catch (e) {
      await trx.rollback();
      throw e;
    }
    const allPlayers = await GamePlayer.findByGameId(game_id);
    const newBids = await db("game_auction_bids").where({ auction_id });
    if (newBids.length >= allPlayers.length) {
      await resolveAuction(req, auction_id);
    }
    const active = await getActiveByGameId(game_id);
    return res.json({ success: true, data: { auction: active } });
  } catch (error) {
    logger.error({ err: error }, "auction placeBid error");
    return res.status(500).json({ success: false, message: error?.message ?? "Failed to place bid" });
  }
}
