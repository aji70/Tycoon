/**
 * Agent tournament runner (server-autonomous).
 *
 * Responsibilities:
 * - Auto-register users (via their authorized agents) into tournaments whose entry fee <= cap.
 * - Auto-request match start during the match start window for agent-bound entries.
 *
 * Safety:
 * - Paid tournaments: requires agent_tournament_permissions (enabled=true), caps, optional chain.
 * - Free tournaments (entry fee 0): any user with agent + smart wallet — no spending permission.
 * - Uses audit log (agent_tournament_spend_log) for paid registrations.
 */
import db from "../config/database.js";
import logger from "../config/logger.js";
import User from "../models/User.js";
import Tournament from "../models/Tournament.js";
import TournamentEntry from "../models/TournamentEntry.js";
import * as tournamentService from "./tournamentService.js";
import { getChainConfig } from "../config/chains.js";
import crypto from "crypto";
import { signWithdrawalAuthUsdc, withdrawFromSmartWalletUsdc } from "./tycoonContract.js";
import { listAgentSmartWalletCandidates } from "./agentTournamentFreeAgents.js";

const ENABLED = process.env.ENABLE_AGENT_TOURNAMENT_RUNNER === "true";
const POLL_MS = Math.max(2000, Number(process.env.AGENT_TOURNAMENT_RUNNER_POLL_MS) || 10000);

// Simple in-process locks: key -> Promise chain
const locks = new Map();
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  let resolve;
  const done = new Promise((r) => (resolve = r));
  locks.set(key, prev.then(() => done));
  return prev
    .then(fn)
    .catch((err) => {
      logger.warn({ err: err?.message, key }, "agent tournament runner step failed");
    })
    .finally(() => {
      resolve();
      if (locks.get(key) === done) locks.delete(key);
    });
}

async function tryAutoRegisterOne(perm, tournament) {
  const userId = Number(perm.user_id);
  const agentId = Number(perm.user_agent_id);
  const tournamentId = Number(tournament.id);
  const chain = User.normalizeChain(tournament.chain);

  const user = await User.findById(userId);
  if (!user?.smart_wallet_address) return;
  const smartWallet = String(user.smart_wallet_address).trim();
  if (!smartWallet) return;

  // Skip if already registered
  const already = await TournamentEntry.hasEntry(tournamentId, { userId });
  if (already) return;

  const vis = String(tournament.visibility || "OPEN").toUpperCase();
  if (vis === "INVITE_ONLY") return;
  if (vis === "BOT_SELECTION") {
    let allowed = tournament.allowed_agent_ids;
    if (typeof allowed === "string") {
      try {
        allowed = JSON.parse(allowed);
      } catch {
        allowed = [];
      }
    }
    if (!Array.isArray(allowed) || !allowed.map(Number).includes(agentId)) return;
  }

  const entryFeeUnits = BigInt(tournament.entry_fee_wei ?? 0);
  const maxUnits = BigInt(perm.max_entry_fee_usdc ?? "0");
  if (entryFeeUnits > maxUnits) return;
  if (perm.daily_cap_usdc) {
    const cap = BigInt(perm.daily_cap_usdc);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const rows = await db("agent_tournament_spend_log")
      .where({ user_id: userId, user_agent_id: agentId })
      .andWhere("created_at", ">=", start)
      .andWhere({ chain })
      .select("amount_usdc");
    let spent = 0n;
    for (const r of rows || []) {
      try { spent += BigInt(r.amount_usdc ?? "0"); } catch {}
    }
    if (spent + entryFeeUnits > cap) return;
  }

  let paymentTxHash = null;
  if (entryFeeUnits > 0n) {
    const cfg = getChainConfig(chain);
    const escrow = cfg.tournamentEscrowAddress;
    const usdc = cfg.usdcAddress ?? process.env.CELO_USDC_ADDRESS ?? process.env.USDC_ADDRESS;
    if (!escrow || !usdc) return;

    const nonce = BigInt("0x" + crypto.randomBytes(8).toString("hex"));
    const sig = await signWithdrawalAuthUsdc(smartWallet, usdc, escrow, entryFeeUnits, nonce, chain);
    const receipt = await withdrawFromSmartWalletUsdc(smartWallet, escrow, entryFeeUnits, nonce, sig, chain);
    paymentTxHash = receipt?.hash ?? null;

    await db("agent_tournament_spend_log").insert({
      user_id: userId,
      user_agent_id: agentId,
      tournament_id: tournamentId,
      chain,
      amount_usdc: entryFeeUnits.toString(),
      tx_hash: paymentTxHash,
      status: paymentTxHash ? "SUBMITTED" : "FAILED",
      error: paymentTxHash ? null : "No tx hash returned",
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
  }

  await tournamentService.registerPlayer(String(tournamentId), { userId, address: null, chain }, paymentTxHash, {
    invite_token: tournament.invite_token,
    user_agent_id: agentId,
  });
}

async function autoRegisterLoop() {
  const tournaments = await Tournament.findAll({ status: "REGISTRATION_OPEN", limit: 50, offset: 0 });
  if (!tournaments?.length) return;

  const paidTournaments = tournaments.filter((t) => BigInt(t.entry_fee_wei ?? 0) > 0n);
  const freeTournaments = tournaments.filter((t) => BigInt(t.entry_fee_wei ?? 0) === 0n);

  const perms = await db("agent_tournament_permissions")
    .where({ enabled: 1 })
    .select("user_id", "user_agent_id", "max_entry_fee_usdc", "daily_cap_usdc", "chain");

  for (const perm of perms || []) {
    for (const t of paidTournaments) {
      const chain = User.normalizeChain(t.chain);
      if (perm.chain && User.normalizeChain(perm.chain) !== chain) continue;
      const count = await TournamentEntry.countByTournament(t.id);
      if (count >= Number(t.max_players)) continue;
      await withLock(`reg_${perm.user_id}_${perm.user_agent_id}_${t.id}`, () => tryAutoRegisterOne(perm, t));
    }
  }

  if (!freeTournaments.length) return;

  const freeCandidates = await listAgentSmartWalletCandidates();
  for (const cand of freeCandidates) {
    const fakePerm = {
      user_id: cand.user_id,
      user_agent_id: cand.user_agent_id,
      max_entry_fee_usdc: cand.max_entry_fee_usdc ?? "0",
      daily_cap_usdc: null,
      chain: null,
    };
    for (const t of freeTournaments) {
      const count = await TournamentEntry.countByTournament(t.id);
      if (count >= Number(t.max_players)) continue;
      await withLock(`reg_${cand.user_id}_${cand.user_agent_id}_${t.id}`, () => tryAutoRegisterOne(fakePerm, t));
    }
  }
}

async function autoStartMatchesLoop() {
  // Find matches that are PENDING/IN_PROGRESS and within start window is handled in tournamentService.requestMatchStart.
  // We just attempt for agent-bound entries, and the service will return waiting/redirect or throw if not in window.
  const rows = await db("tournament_entry_agents as tea")
    .join("tournament_entries as te", "tea.tournament_entry_id", "te.id")
    .join("tournament_matches as tm", "tm.tournament_id", "te.tournament_id")
    .whereRaw(
      "(tm.slot_a_entry_id = te.id OR tm.slot_b_entry_id = te.id OR JSON_CONTAINS(COALESCE(tm.participant_entry_ids, JSON_ARRAY()), CAST(te.id AS JSON), '$'))"
    )
    .select(
      "tea.user_agent_id",
      "te.user_id",
      "te.tournament_id",
      "tm.id as match_id"
    )
    .whereNotIn("tm.status", ["COMPLETED", "BYE"])
    .limit(200);

  for (const r of rows || []) {
    const key = `start_${r.tournament_id}_${r.match_id}_${r.user_id}`;
    await withLock(key, async () => {
      try {
        await tournamentService.requestMatchStart(String(r.tournament_id), String(r.match_id), Number(r.user_id), null);
      } catch (_) {
        // Silent: most attempts will be outside window.
      }
    });
  }
}

async function pollOnce() {
  await autoRegisterLoop();
  await autoStartMatchesLoop();
}

export function startAgentTournamentRunner() {
  if (!ENABLED) {
    logger.info("Agent tournament runner disabled (set ENABLE_AGENT_TOURNAMENT_RUNNER=true to enable)");
    return;
  }
  logger.info({ pollMs: POLL_MS }, "Agent tournament runner starting");
  setInterval(() => {
    pollOnce().catch((err) => logger.warn({ err: err?.message }, "Agent tournament runner poll failed"));
  }, POLL_MS);
}

