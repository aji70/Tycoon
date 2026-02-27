/**
 * Tournament payouts: compute amounts by placement, execute (USDC/vouchers).
 * For MVP, executePayouts is a stub; implement when prize pool is held (treasury or escrow).
 */
import Tournament from "../models/Tournament.js";
import TournamentEntry from "../models/TournamentEntry.js";
import TournamentMatch from "../models/TournamentMatch.js";
import User from "../models/User.js";
import logger from "../config/logger.js";

/**
 * Compute payout list for a completed tournament: [{ entry_id, rank, amount_wei }].
 */
export async function computePayouts(tournamentId) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament || tournament.status !== "COMPLETED") return [];
  if (tournament.prize_source === "NO_POOL") return [];

  const pool =
    tournament.prize_source === "CREATOR_FUNDED"
      ? Number(tournament.prize_pool_wei) || 0
      : 0; // TODO: entry-fee pool from sum of entry payments

  if (pool <= 0) return [];

  const dist = tournament.prize_distribution || { 1: 50, 2: 30, 3: 15, 4: 5 };
  const matches = await TournamentMatch.findByTournament(tournamentId);
  const rounds = [...new Set(matches.map((m) => m.round_index))].sort((a, b) => b - a);
  const placementByEntryId = {};
  const finalMatch = matches.find((m) => m.round_index === rounds[0] && m.match_index === 0);
  if (finalMatch?.winner_entry_id) placementByEntryId[finalMatch.winner_entry_id] = 1;
  if (finalMatch) {
    const loser = finalMatch.slot_a_entry_id === finalMatch.winner_entry_id ? finalMatch.slot_b_entry_id : finalMatch.slot_a_entry_id;
    if (loser) placementByEntryId[loser] = 2;
  }
  let place = 3;
  for (let r = 1; r < rounds.length; r++) {
    const roundMatches = matches.filter((m) => m.round_index === rounds[r]);
    for (const m of roundMatches) {
      if (m.winner_entry_id && placementByEntryId[m.winner_entry_id] == null) placementByEntryId[m.winner_entry_id] = place++;
      const other = m.slot_a_entry_id === m.winner_entry_id ? m.slot_b_entry_id : m.slot_a_entry_id;
      if (other && placementByEntryId[other] == null) placementByEntryId[other] = place++;
    }
  }

  const payouts = [];
  for (const [entryIdStr, rank] of Object.entries(placementByEntryId)) {
    const entryId = Number(entryIdStr);
    const pct = Number(dist[rank]) || 0;
    if (pct <= 0) continue;
    const amount = Math.floor((pool * pct) / 100);
    if (amount > 0) payouts.push({ entry_id: entryId, rank, amount_wei: amount });
  }
  return payouts;
}

/**
 * Execute payouts (send USDC or mint vouchers). MVP: log only; implement when treasury/escrow exists.
 */
export async function executePayouts(tournamentId) {
  const payouts = await computePayouts(tournamentId);
  if (payouts.length === 0) return { done: 0, message: "No payouts" };

  logger.info({ tournamentId, payouts }, "Tournament payouts computed (execute not implemented: no treasury/escrow)");
  // TODO: for each payout, get entry -> user address, send USDC from treasury or mint voucher
  return { done: 0, message: "Payouts computed; execution not implemented", payouts };
}
