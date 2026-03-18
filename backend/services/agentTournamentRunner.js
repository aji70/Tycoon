/**
 * Agent tournament runner (server-autonomous).
 *
 * Responsibilities:
 * - Auto-register users (via their authorized agents) into tournaments whose entry fee <= cap.
 * - Auto-request match start during the match start window for agent-bound entries.
 *
 * Safety:
 * - Requires explicit user permission in agent_tournament_permissions (enabled=true).
 * - Enforces max_entry_fee_usdc and optional chain restriction.
 * - Uses audit log (agent_tournament_spend_log) for paid registrations.
 */
import db from "../config/database.js";
import logger from "../config/logger.js";
import User from "../models/User.js";
import UserAgent from "../models/UserAgent.js";
import Tournament from "../models/Tournament.js";
import TournamentEntry from "../models/TournamentEntry.js";
import * as tournamentService from "./tournamentService.js";
import { getChainConfig } from "../config/chains.js";
import crypto from "crypto";
import { signWithdrawalAuthUsdc, withdrawFromSmartWalletUsdc } from "./tycoonContract.js";

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

  const entry = await tournamentService.registerPlayer(String(tournamentId), { userId, address: null, chain }, paymentTxHash);

  // Bind entry -> agent
  const agent = await UserAgent.findByIdAndUser(agentId, userId);
  await db("tournament_entry_agents").insert({
    tournament_entry_id: entry.id,
    user_agent_id: agentId,
    agent_name: agent?.name || null,
    created_at: db.fn.now(),
    updated_at: db.fn.now(),
  });
}

async function autoRegisterLoop() {
  const perms = await db("agent_tournament_permissions")
    .where({ enabled: 1 })
    .select("user_id", "user_agent_id", "max_entry_fee_usdc", "daily_cap_usdc", "chain");
  if (!perms?.length) return;

  // Fetch open tournaments (cap at 50 per poll).
  const tournaments = await Tournament.findAll({ status: "REGISTRATION_OPEN", limit: 50, offset: 0 });
  if (!tournaments?.length) return;

  for (const perm of perms) {
    for (const t of tournaments) {
      const chain = User.normalizeChain(t.chain);
      if (perm.chain && User.normalizeChain(perm.chain) !== chain) continue;
      // Capacity check
      const count = await TournamentEntry.countByTournament(t.id);
      if (count >= Number(t.max_players)) continue;
      await withLock(`reg_${perm.user_id}_${perm.user_agent_id}_${t.id}`, () => tryAutoRegisterOne(perm, t));
    }
  }
}

async function autoStartMatchesLoop() {
  // Find matches that are PENDING/IN_PROGRESS and within start window is handled in tournamentService.requestMatchStart.
  // We just attempt for agent-bound entries, and the service will return waiting/redirect or throw if not in window.
  const rows = await db("tournament_entry_agents as tea")
    .join("tournament_entries as te", "tea.tournament_entry_id", "te.id")
    .join("tournament_matches as tm", function () {
      this.on("tm.slot_a_entry_id", "=", "te.id").orOn("tm.slot_b_entry_id", "=", "te.id");
    })
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

