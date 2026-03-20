/**
 * Agent tournament permissions + auto-join.
 * Allows a user to explicitly authorize an agent to spend from their smart wallet (USDC)
 * to join tournaments up to a capped entry fee, and to auto-start matches.
 */
import db from "../config/database.js";
import logger from "../config/logger.js";
import User from "../models/User.js";
import UserAgent from "../models/UserAgent.js";
import Tournament from "../models/Tournament.js";
import * as tournamentService from "../services/tournamentService.js";
import { getChainConfig } from "../config/chains.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { ethers } from "ethers";
import {
  signWithdrawalAuthUsdc,
  withdrawFromSmartWalletUsdc,
} from "../services/tycoonContract.js";
import { ACTIVITY_XP, awardActivityXpByAgentId } from "../services/eloService.js";

function parseUsdcUnits(v) {
  // Accept number/string representing USDC units (e.g. "1.5") -> bigint units (6 decimals)
  if (v == null) return 0n;
  const s = String(v).trim();
  if (!s) return 0n;
  return ethers.parseUnits(s, 6);
}

function unitsToString(units) {
  try {
    return units != null ? BigInt(units).toString() : "0";
  } catch {
    return "0";
  }
}

async function spentTodayUsdc(userId, userAgentId, chain) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const q = db("agent_tournament_spend_log")
    .where({ user_id: userId, user_agent_id: userAgentId })
    .andWhere("created_at", ">=", start);
  if (chain) q.andWhere({ chain });
  const rows = await q.select("amount_usdc");
  let sum = 0n;
  for (const r of rows || []) {
    try { sum += BigInt(r.amount_usdc ?? "0"); } catch {}
  }
  return sum;
}

export async function listTournamentPermissions(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const rows = await db("agent_tournament_permissions")
      .where({ user_id: userId })
      .orderBy("id", "desc");
    return res.json({ success: true, data: rows });
  } catch (err) {
    logger.error({ err: err?.message, userId: req.user?.id }, "listTournamentPermissions failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to list permissions" });
  }
}

export async function upsertTournamentPermission(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const agentId = Number(req.params.agentId);
    if (!agentId) return res.status(400).json({ success: false, message: "Invalid agent id" });

    const agent = await UserAgent.findByIdAndUser(agentId, userId);
    if (!agent) return res.status(404).json({ success: false, message: "Agent not found" });

    const enabled = req.body?.enabled === true;
    const chain = req.body?.chain != null && String(req.body.chain).trim() ? User.normalizeChain(req.body.chain) : null;
    const maxEntryFeeUnits = parseUsdcUnits(req.body?.max_entry_fee_usdc ?? req.body?.max_entry_fee);
    const dailyCapUnits = req.body?.daily_cap_usdc != null && String(req.body.daily_cap_usdc).trim() !== ""
      ? parseUsdcUnits(req.body.daily_cap_usdc)
      : null;

    if (enabled) {
      // Require explicit PIN confirmation once when enabling spending permission.
      const user = await User.findById(userId);
      if (!user?.withdrawal_pin_hash) {
        return res.status(400).json({ success: false, message: "Set a withdrawal PIN first (Profile → Manage smart wallet)." });
      }
      const pin = req.body?.pin != null ? String(req.body.pin).trim() : "";
      if (!pin) return res.status(400).json({ success: false, message: "PIN required to enable agent spending." });
      const ok = await bcrypt.compare(pin, user.withdrawal_pin_hash);
      if (!ok) return res.status(401).json({ success: false, message: "Invalid PIN." });
    }

    const payload = {
      user_id: userId,
      user_agent_id: agentId,
      enabled,
      max_entry_fee_usdc: unitsToString(maxEntryFeeUnits),
      daily_cap_usdc: dailyCapUnits != null ? unitsToString(dailyCapUnits) : null,
      chain,
      updated_at: db.fn.now(),
    };

    const existing = await db("agent_tournament_permissions").where({ user_id: userId, user_agent_id: agentId }).first();
    if (existing) {
      await db("agent_tournament_permissions").where({ id: existing.id }).update(payload);
    } else {
      await db("agent_tournament_permissions").insert({ ...payload, created_at: db.fn.now(), updated_at: db.fn.now() });
    }

    const row = await db("agent_tournament_permissions").where({ user_id: userId, user_agent_id: agentId }).first();
    return res.json({ success: true, data: row });
  } catch (err) {
    logger.error({ err: err?.message, userId: req.user?.id }, "upsertTournamentPermission failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed to update permission" });
  }
}

/**
 * POST /api/agents/:agentId/auto-join-tournament
 * Body: { tournament_id }
 * Joins a tournament using smart wallet funds (if required) subject to permission caps.
 */
export async function autoJoinTournament(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const agentId = Number(req.params.agentId);
    const tournamentId = Number(req.body?.tournament_id);
    if (!agentId || !tournamentId) return res.status(400).json({ success: false, message: "agentId and tournament_id required" });

    const agent = await UserAgent.findByIdAndUser(agentId, userId);
    if (!agent) return res.status(404).json({ success: false, message: "Agent not found" });

    const perm = await db("agent_tournament_permissions").where({ user_id: userId, user_agent_id: agentId }).first();
    if (!perm?.enabled) return res.status(403).json({ success: false, message: "Agent tournament permission not enabled" });

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return res.status(404).json({ success: false, message: "Tournament not found" });
    if (tournament.status !== "REGISTRATION_OPEN") return res.status(400).json({ success: false, message: "Tournament registration is closed" });

    const chain = User.normalizeChain(tournament.chain);
    if (perm.chain && User.normalizeChain(perm.chain) !== chain) {
      return res.status(400).json({ success: false, message: `Permission is restricted to ${perm.chain}` });
    }

    const entryFeeUnits = BigInt(tournament.entry_fee_wei ?? 0);
    const maxUnits = BigInt(perm.max_entry_fee_usdc ?? "0");
    if (entryFeeUnits > maxUnits) {
      return res.status(403).json({ success: false, message: "Tournament entry fee exceeds your agent cap" });
    }
    if (perm.daily_cap_usdc) {
      const cap = BigInt(perm.daily_cap_usdc);
      const spent = await spentTodayUsdc(userId, agentId, chain);
      if (spent + entryFeeUnits > cap) {
        return res.status(403).json({ success: false, message: "Daily spend cap reached for this agent" });
      }
    }

    const user = await User.findById(userId);
    const smartWallet = user?.smart_wallet_address && String(user.smart_wallet_address).trim();
    if (!smartWallet) return res.status(400).json({ success: false, message: "No smart wallet. Create one in Profile first." });

    let paymentTxHash = null;
    if (entryFeeUnits > 0n) {
      const cfg = getChainConfig(chain);
      const escrow = cfg.tournamentEscrowAddress;
      const usdc = cfg.usdcAddress ?? process.env.CELO_USDC_ADDRESS ?? process.env.USDC_ADDRESS;
      if (!escrow) return res.status(500).json({ success: false, message: "Tournament escrow not configured for this chain" });
      if (!usdc) return res.status(500).json({ success: false, message: "USDC not configured for this chain" });

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

    // Bind the tournament entry to this agent for later match auto-play.
    await db("tournament_entry_agents").insert({
      tournament_entry_id: entry.id,
      user_agent_id: agentId,
      agent_name: agent?.name || null,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
    awardActivityXpByAgentId(agentId, ACTIVITY_XP.TOURNAMENT_JOINED, "tournament_joined").catch(() => {});

    return res.status(201).json({ success: true, data: entry });
  } catch (err) {
    const msg = err?.message || String(err);
    logger.error({ err: msg, userId: req.user?.id }, "autoJoinTournament failed");
    return res.status(400).json({ success: false, message: msg });
  }
}

