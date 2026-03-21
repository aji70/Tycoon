/**
 * Finalize a stuck tournament from the shell (same logic as POST /api/tournaments/:id/admin-resolve).
 * Resolves winner by wallet address → user → tournament entry, then marks COMPLETED and runs payouts / escrow.
 *
 * Example — tournament 42, 0.1 USDC stake, 2 players, winner 0x9F3… (set WINNER_CHAIN to match tournament.chain, e.g. CELO):
 *   cd backend && EXPECT_PARTICIPANTS=2 EXPECT_STAKE_USDC=0.1 WINNER_CHAIN=CELO \\
 *     npm run finalize-tournament -- 42 0x9F3C421895bBCee5fA2BfD94E8C2eE36FdC7A80E
 *
 * Plain node:
 *   node -r dotenv/config scripts/finalize-tournament-admin.js 42 0x9F3C421895bBCee5fA2BfD94E8C2eE36FdC7A80E
 *
 * Or env-only:
 *   TOURNAMENT_ID=42 WINNER_ADDRESS=0x9F3C... WINNER_CHAIN=CELO node -r dotenv/config scripts/finalize-tournament-admin.js
 *
 * Optional:
 *   EXPECT_PARTICIPANTS=2   — abort if entry row count does not match
 *   EXPECT_STAKE_USDC=0.1   — abort if tournament.entry_fee_wei !== stake * 1e6 (6 decimals)
 *
 * Requires backend .env with DB (e.g. DATABASE_URL). No HTTP server needed.
 */

import User from "../models/User.js";
import TournamentEntry from "../models/TournamentEntry.js";
import Tournament from "../models/Tournament.js";
import { adminResolveTournament } from "../services/tournamentService.js";

function parseArgs() {
  const a = process.argv.slice(2).filter(Boolean);
  let tid = null;
  let winner = null;
  if (a[0] && /^\d+$/.test(a[0])) tid = Number(a[0]);
  if (a[1] && String(a[1]).startsWith("0x")) winner = String(a[1]).trim();
  if (tid == null && process.env.TOURNAMENT_ID != null && String(process.env.TOURNAMENT_ID).trim() !== "") {
    tid = Number(process.env.TOURNAMENT_ID);
  }
  if (!winner && process.env.WINNER_ADDRESS) winner = String(process.env.WINNER_ADDRESS).trim();
  const chain = String(process.env.WINNER_CHAIN || "CELO").trim() || "CELO";
  return { tid, winner, chain };
}

async function main() {
  const { tid, winner, chain } = parseArgs();
  if (!tid || tid <= 0) {
    console.error("Missing tournament id. Pass as first arg or TOURNAMENT_ID.");
    process.exit(1);
  }
  if (!winner || !/^0x[a-fA-F0-9]{40}$/.test(winner)) {
    console.error("Missing or invalid winner address. Pass as second arg or WINNER_ADDRESS.");
    process.exit(1);
  }

  const tournament = await Tournament.findById(tid);
  if (!tournament) {
    console.error(`Tournament ${tid} not found.`);
    process.exit(1);
  }

  const entries = await TournamentEntry.findByTournament(tid);
  const expect = process.env.EXPECT_PARTICIPANTS != null ? Number(process.env.EXPECT_PARTICIPANTS) : null;
  if (expect != null && !Number.isNaN(expect) && entries.length !== expect) {
    console.error(`Expected ${expect} participants, found ${entries.length}.`);
    process.exit(1);
  }

  const stakeUsdcEnv = process.env.EXPECT_STAKE_USDC;
  if (stakeUsdcEnv != null && String(stakeUsdcEnv).trim() !== "") {
    const expectedWei = Math.round(Number(stakeUsdcEnv) * 1e6);
    if (!Number.isFinite(expectedWei)) {
      console.error("EXPECT_STAKE_USDC must be a number (e.g. 0.1).");
      process.exit(1);
    }
    const actualWei = Number(tournament.entry_fee_wei) || 0;
    if (actualWei !== expectedWei) {
      console.error(
        `Expected entry_fee_wei ${expectedWei} (${stakeUsdcEnv} USDC), database has ${actualWei}. Refusing to finalize.`
      );
      process.exit(1);
    }
  }

  let user = await User.resolveUserByAddress(winner, chain);
  if (!user) user = await User.findByAddressOnly(winner);
  if (!user) user = await User.findByAddressOnly(winner.toLowerCase());
  if (!user) {
    console.error(`No user found for address ${winner} (tried chain ${chain} and address-only).`);
    process.exit(1);
  }

  const entry = await TournamentEntry.findByTournamentAndUser(tid, user.id);
  if (!entry) {
    console.error(`User id ${user.id} has no entry in tournament ${tid}.`);
    process.exit(1);
  }

  console.log("Tournament:", {
    id: tournament.id,
    name: tournament.name,
    status: tournament.status,
    prize_source: tournament.prize_source,
    entry_fee_wei: tournament.entry_fee_wei,
    chain: tournament.chain,
    participant_count: entries.length,
  });
  console.log("Winner:", { user_id: user.id, entry_id: entry.id, address: winner });

  const result = await adminResolveTournament(tid, {
    mode: "payout",
    winner_entry_id: entry.id,
  });

  console.log("Done:", JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
