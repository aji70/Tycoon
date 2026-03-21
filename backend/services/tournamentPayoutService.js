/**
 * Tournament payouts: compute amounts by placement, execute USDC to smart wallets.
 * Supports ENTRY_FEE_POOL and CREATOR_FUNDED tournaments.
 */
import db from "../config/database.js";
import Tournament from "../models/Tournament.js";
import TournamentEntry from "../models/TournamentEntry.js";
import TournamentMatch from "../models/TournamentMatch.js";
import User from "../models/User.js";
import logger from "../config/logger.js";
import { isEscrowConfigured, lockAndFinalizeTournamentOnEscrow } from "./tournamentEscrow.js";

/**
 * Persist one tournament payout row (same semantics as executePayouts loop).
 * @param {number} tournamentId
 * @param {{ user_id: number, user_agent_id?: number|null, amount_wei: number, placement: number }} row
 */
async function insertTournamentPayoutRecord(tournamentId, row) {
  const user = await User.findById(row.user_id);
  if (!user) {
    logger.warn({ userId: row.user_id }, "insertTournamentPayoutRecord: user not found");
    return { ok: false };
  }

  const smartWalletAddress = user.smart_wallet_address;
  if (!smartWalletAddress) {
    await db("tournament_payouts").insert({
      tournament_id: tournamentId,
      user_id: user.id,
      user_agent_id: row.user_agent_id || null,
      smart_wallet_address: "0x0000000000000000000000000000000000000000",
      amount_usdc: String(row.amount_wei),
      placement: row.placement,
      status: "PENDING",
      error_reason: "Smart wallet not configured",
    });
    logger.warn({ tournamentId, userId: user.id }, "insertTournamentPayoutRecord: no smart wallet");
    return { ok: false };
  }

  const [payoutId] = await db("tournament_payouts").insert({
    tournament_id: tournamentId,
    user_id: user.id,
    user_agent_id: row.user_agent_id || null,
    smart_wallet_address: smartWalletAddress,
    amount_usdc: String(row.amount_wei),
    placement: row.placement,
    status: "SENT",
    sent_at: new Date(),
  });

  logger.info(
    { tournamentId, payoutRecordId: payoutId, userId: user.id, amount: row.amount_wei, placement: row.placement },
    "Payout record created"
  );
  return { ok: true };
}

/**
 * Staked arena draw: house keeps 5% of the pool; remaining 95% split equally among all entries.
 */
export async function executeDrawRefunds(tournamentId) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.prize_source !== "ENTRY_FEE_POOL") {
    throw new Error("Draw refunds only apply to entry-fee pool tournaments");
  }

  const existingRow = await db("tournament_payouts").where({ tournament_id: tournamentId }).count("* as c").first();
  const existingCount = Number(existingRow?.c ?? 0);
  if (existingCount > 0) {
    logger.info({ tournamentId, existingCount }, "executeDrawRefunds: rows already exist; idempotent skip");
    return { done: existingCount, failed: 0, message: "Already recorded", skipped: true, houseWei: 0, toPlayers: 0 };
  }

  const entries = await TournamentEntry.findByTournament(tournamentId);
  if (!entries?.length) {
    logger.info({ tournamentId }, "executeDrawRefunds: no entries");
    return { done: 0, failed: 0, message: "No entries" };
  }

  const count = entries.length;
  const pool = (Number(tournament.entry_fee_wei) || 0) * count;
  if (pool <= 0) {
    return { done: 0, failed: 0, message: "Zero pool" };
  }

  const houseWei = Math.floor((pool * 5) / 100);
  const toPlayers = pool - houseWei;
  const base = Math.floor(toPlayers / count);
  let remainder = toPlayers - base * count;

  const rows = [];
  let rem = remainder;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const amountWei = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem -= 1;
    rows.push({ entry, amountWei });
  }

  const escrowPlan = [];
  for (const { entry, amountWei } of rows) {
    const user = await User.findById(entry.user_id);
    const sw = user?.smart_wallet_address && String(user.smart_wallet_address).trim();
    if (sw && amountWei > 0) escrowPlan.push({ address: sw, amountWei });
  }

  if (escrowPlan.length > 0) {
    const res = await lockAndFinalizeTournamentOnEscrow(tournamentId, tournament.chain, escrowPlan);
    if (res?.skipped && isEscrowConfigured(tournament.chain)) {
      const fatal = ["zero_onchain_pool", "read_failed"];
      if (fatal.includes(res.reason)) {
        throw new Error(`Escrow draw payout failed (${res.reason}) for tournament ${tournamentId}`);
      }
    }
  }

  let done = 0;
  let failed = 0;

  for (const { entry, amountWei } of rows) {
    const tea = await db("tournament_entry_agents").where("tournament_entry_id", entry.id).first();
    const userAgentId = tea?.user_agent_id ?? null;

    const r = await insertTournamentPayoutRecord(tournamentId, {
      user_id: entry.user_id,
      user_agent_id: userAgentId,
      amount_wei: amountWei,
      placement: 1,
    });
    if (r.ok) done++;
    else failed++;
  }

  logger.info(
    { tournamentId, pool, houseWei, toPlayers, count, done, failed },
    "Draw refunds: 5% house, remainder split equally"
  );

  return { done, failed, message: `Draw refunds: ${done} sent, ${failed} failed`, houseWei, toPlayers };
}

/**
 * Compute payout list for a completed tournament: [{ entry_id, rank, amount_wei }].
 * ENTRY_FEE_POOL: pool = entry_fee_wei * participant count. CREATOR_FUNDED: pool from prize_pool_wei.
 */
export async function computePayouts(tournamentId) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament || tournament.status !== "COMPLETED") return [];
  if (tournament.prize_source === "NO_POOL") return [];

  let pool = 0;
  if (tournament.prize_source === "CREATOR_FUNDED") {
    pool = Number(tournament.prize_pool_wei) || 0;
  } else if (tournament.prize_source === "ENTRY_FEE_POOL") {
    const count = await TournamentEntry.countByTournament(tournamentId);
    pool = (Number(tournament.entry_fee_wei) || 0) * count;
  }

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
 * Execute payouts: transfer USDC from tournament escrow to smart wallets.
 * Persists payout records to tournament_payouts table.
 */
export async function executePayouts(tournamentId) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) throw new Error("Tournament not found");

  const existingRow = await db("tournament_payouts").where({ tournament_id: tournamentId }).count("* as c").first();
  const existingCount = Number(existingRow?.c ?? 0);
  if (existingCount > 0) {
    logger.info({ tournamentId, existingCount }, "executePayouts: rows already exist; idempotent skip");
    return { done: existingCount, failed: 0, message: "Already recorded", skipped: true };
  }

  const payouts = await computePayouts(tournamentId);
  if (payouts.length === 0) {
    logger.info({ tournamentId }, "No payouts to execute");
    return { done: 0, failed: 0, message: "No payouts" };
  }

  const escrowPlan = [];
  for (const payout of payouts) {
    const entry = await TournamentEntry.findById(payout.entry_id);
    if (!entry) continue;
    const user = await User.findById(entry.user_id);
    const sw = user?.smart_wallet_address && String(user.smart_wallet_address).trim();
    if (sw && payout.amount_wei > 0) escrowPlan.push({ address: sw, amountWei: payout.amount_wei });
  }

  if (escrowPlan.length > 0) {
    const res = await lockAndFinalizeTournamentOnEscrow(tournamentId, tournament.chain, escrowPlan);
    if (res?.skipped && isEscrowConfigured(tournament.chain)) {
      const fatal = ["zero_onchain_pool", "read_failed"];
      if (fatal.includes(res.reason)) {
        throw new Error(`Escrow winner payout failed (${res.reason}) for tournament ${tournamentId}`);
      }
    }
  }

  let done = 0;
  let failed = 0;

  for (const payout of payouts) {
    try {
      const entry = await TournamentEntry.findById(payout.entry_id);
      if (!entry) {
        logger.warn({ payoutId: payout.entry_id }, "Entry not found for payout");
        failed++;
        continue;
      }

      const tea = await db("tournament_entry_agents").where("tournament_entry_id", entry.id).first();
      const userAgentId = tea?.user_agent_id ?? null;

      const r = await insertTournamentPayoutRecord(tournamentId, {
        user_id: entry.user_id,
        user_agent_id: userAgentId,
        amount_wei: payout.amount_wei,
        placement: payout.rank,
      });
      if (r.ok) done++;
      else failed++;
    } catch (err) {
      logger.error(
        { err: err?.message, tournamentId, payoutId: payout.entry_id },
        "Failed to execute payout"
      );
      failed++;
    }
  }

  return { done, failed, message: `Processed ${done} payouts, ${failed} failed`, payouts };
}

/**
 * Get pending payouts for a user (can be claimed).
 */
export async function getUserPendingPayouts(userId) {
  return db("tournament_payouts")
    .where("user_id", userId)
    .where("status", "PENDING")
    .orderBy("created_at", "desc");
}

/**
 * Mark a payout as claimed by user.
 */
export async function claimPayout(payoutId, userId) {
  const payout = await db("tournament_payouts").where("id", payoutId).first();
  if (!payout) throw new Error("Payout not found");
  if (payout.user_id !== userId) throw new Error("Payout does not belong to this user");

  await db("tournament_payouts")
    .where("id", payoutId)
    .update({ status: "CLAIMED", claimed_at: new Date() });

  return db("tournament_payouts").where("id", payoutId).first();
}
