/**
 * Tournament controller: create, list, get, register, bracket, leaderboard, close registration, start round.
 */
import Tournament from "../models/Tournament.js";
import User from "../models/User.js";
import TournamentEntry from "../models/TournamentEntry.js";
import TournamentMatch from "../models/TournamentMatch.js";
import TournamentRound from "../models/TournamentRound.js";
import * as tournamentService from "../services/tournamentService.js";
import logger from "../config/logger.js";
import db from "../config/database.js";
import UserAgent from "../models/UserAgent.js";
import { getChainConfig } from "../config/chains.js";
import crypto from "crypto";
import { signWithdrawalAuthUsdc, withdrawFromSmartWalletUsdc } from "../services/tycoonContract.js";
import { ACTIVITY_XP, awardActivityXpByAgentId } from "../services/eloService.js";
import { listAgentSmartWalletCandidates } from "../services/agentTournamentFreeAgents.js";
import { parseParticipantEntryIds } from "../services/tournamentGroupHelpers.js";

/**
 * Ordered 1st / 2nd / 3rd … for a bracket match (from game.placements or 2p winner/loser).
 */
function standingsForBracketMatch(match, game, entryMap, displayName) {
  const st = String(match.status || "").toUpperCase();
  if (st === "BYE" && match.winner_entry_id) {
    const eid = Number(match.winner_entry_id);
    return [
      {
        place: 1,
        entry_id: eid,
        username: displayName(entryMap[eid]),
      },
    ];
  }
  if (st !== "COMPLETED") return null;

  let entryIds = parseParticipantEntryIds(match);
  if (!entryIds.length) {
    entryIds = [match.slot_a_entry_id, match.slot_b_entry_id].filter(Boolean).map(Number);
  }
  const unique = [...new Set(entryIds.filter((id) => Number.isInteger(id) && id > 0))];

  let placements = {};
  if (game?.placements != null) {
    let raw = game.placements;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = {};
      }
    }
    if (raw && typeof raw === "object") placements = raw;
  }

  const rows = unique.map((eid) => {
    const e = entryMap[eid];
    const uid = e?.user_id != null ? Number(e.user_id) : null;
    let place = 999;
    if (uid != null) {
      if (Object.prototype.hasOwnProperty.call(placements, uid)) place = Number(placements[uid]);
      else if (Object.prototype.hasOwnProperty.call(placements, String(uid))) place = Number(placements[String(uid)]);
    }
    return {
      entry_id: eid,
      place,
      username: displayName(e),
    };
  });

  const allBad = rows.length > 0 && rows.every((r) => r.place >= 900);
  if (allBad && unique.length === 2 && match.winner_entry_id) {
    const wid = Number(match.winner_entry_id);
    rows.forEach((r) => {
      r.place = r.entry_id === wid ? 1 : 2;
    });
  }

  rows.sort((a, b) => a.place - b.place || a.entry_id - b.entry_id);
  return rows;
}

/**
 * GET /api/tournaments/spectate/:token — resolve tournament match spectator link to board URL.
 */
export async function getSpectate(req, res) {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ success: false, message: "Token required" });
    const match = await db("tournament_matches").where({ spectator_token: token }).first();
    if (!match) return res.status(404).json({ success: false, message: "Spectator link not found" });
    if (!match.game_id) {
      return res.json({
        success: true,
        match_status: match.status,
        game_code: null,
        redirect_url: null,
        message: "Match has not started yet",
      });
    }
    const game = await db("games").where({ id: match.game_id }).first();
    const code = game?.code ? String(game.code) : "";
    return res.json({
      success: true,
      match_status: match.status,
      game_code: code,
      redirect_url: code ? `/board-3d-multi?gameCode=${encodeURIComponent(code)}&spectate=1` : null,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "tournament getSpectate failed");
    return res.status(500).json({ success: false, message: err?.message || "Failed" });
  }
}

export async function list(req, res) {
  try {
    const { status, chain, prize_source, limit = 50, offset = 0, public_arena, tournament_kind } = req.query;
    const kind =
      tournament_kind === "human" || tournament_kind === "agent" ? tournament_kind : null;
    const publicArena =
      kind == null && (public_arena === "1" || public_arena === "true");
    const tournaments = await Tournament.findAll({
      status,
      chain,
      prize_source,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
      tournament_kind: kind,
      public_arena: publicArena,
    });
    return res.json(tournaments);
  } catch (err) {
    logger.error({ err: err?.message }, "tournament list failed");
    return res.status(500).json({ success: false, message: err?.message || "List failed" });
  }
}

export async function getById(req, res) {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ success: false, message: "Tournament not found" });
    const entries = await TournamentEntry.findByTournament(req.params.id, { withUser: true });
    const rounds = await TournamentRound.findByTournament(req.params.id);
    const matches = await TournamentMatch.findByTournament(req.params.id);
    const gameIds = [...new Set((matches || []).map((m) => m.game_id).filter(Boolean))];
    let matchGameTypeById = {};
    if (gameIds.length) {
      const gRows = await db("games").whereIn("id", gameIds).select("id", "game_type");
      matchGameTypeById = Object.fromEntries((gRows || []).map((r) => [r.id, r.game_type]));
    }
    const matchesWithGameType = (matches || []).map((m) => ({
      ...m,
      match_game_type: m.game_id ? matchGameTypeById[m.game_id] ?? null : null,
    }));
    const creator = tournament.creator_id ? await User.findById(tournament.creator_id) : null;
    const creator_address =
      creator?.address ||
      creator?.linked_wallet_address ||
      null;
    const isCreator = req.user?.id && Number(req.user.id) === Number(tournament.creator_id);
    const vis = String(tournament.visibility || "OPEN").toUpperCase();
    const safe = { ...tournament };
    delete safe.allowed_agent_ids;
    if (vis === "INVITE_ONLY" && !isCreator) {
      delete safe.invite_token;
    }
    let allowed_agent_ids = null;
    if (vis === "BOT_SELECTION" && tournament.allowed_agent_ids != null) {
      try {
        allowed_agent_ids =
          typeof tournament.allowed_agent_ids === "string"
            ? JSON.parse(tournament.allowed_agent_ids)
            : tournament.allowed_agent_ids;
      } catch {
        allowed_agent_ids = null;
      }
    }
    return res.json({
      ...safe,
      allowed_agent_ids,
      creator_address: creator_address || undefined,
      is_creator: Boolean(isCreator),
      entries,
      rounds,
      matches: matchesWithGameType,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "tournament getById failed");
    return res.status(500).json({ success: false, message: err?.message || "Get failed" });
  }
}

export async function create(req, res) {
  try {
    let creatorId = req.user?.id || req.body.creator_id;
    if (!creatorId && req.body.address) {
      const chainForAddress = req.body.wallet_chain || req.body.chain || "POLYGON";
      const user = await User.resolveUserByAddress(req.body.address, chainForAddress);
      if (user) creatorId = user.id;
    }
    if (!creatorId) return res.status(401).json({ success: false, message: "Sign in or register your wallet (Profile) to create a tournament" });
    const { chain, address, wallet_chain, ...rest } = req.body;
    if (chain == null || String(chain).trim() === "") {
      return res.status(400).json({ success: false, message: "chain is required (e.g. POLYGON, BASE, CELO)" });
    }
    const result = await tournamentService.createTournament({ ...rest, creator_id: creatorId, chain });
    // Response includes tournament plus on-chain status: created_on_chain, on_chain_error, on_chain_tx_hash
    return res.status(201).json({
      ...result,
      created_on_chain: result.created_on_chain ?? false,
      on_chain_error: result.on_chain_error ?? null,
      on_chain_tx_hash: result.on_chain_tx_hash ?? null,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "tournament create failed");
    return res.status(400).json({ success: false, message: err?.message || "Create failed" });
  }
}

export async function register(req, res) {
  try {
    const tournamentId = req.params.id;
    const userId = req.user?.id;
    const { address, chain, payment_tx_hash, invite_token, user_agent_id } = req.body || {};
    const entry = await tournamentService.registerPlayer(
      tournamentId,
      { userId, address, chain },
      payment_tx_hash,
      {
        invite_token,
        user_agent_id: user_agent_id != null ? Number(user_agent_id) : undefined,
      }
    );
    return res.status(201).json({ success: true, data: entry });
  } catch (err) {
    if (err?.message?.includes("Already registered") || err?.message?.includes("already registered")) return res.status(409).json({ success: false, message: err.message });
    if (err?.message?.includes("not found")) return res.status(404).json({ success: false, message: err.message });
    if (err?.message?.includes("Registration is closed") || err?.message?.includes("full")) return res.status(400).json({ success: false, message: err.message });
    logger.error({ err: err?.message }, "tournament register failed");
    return res.status(400).json({ success: false, message: err?.message || "Register failed" });
  }
}

/**
 * POST /tournaments/:id/auto-fill-agents
 * Creator/admin convenience: auto-register eligible "bot agents" into the tournament (up to desired_count).
 * Eligibility (paid entry fee > 0):
 * - agent_tournament_permissions.enabled = true, chain matches (or null), max_entry_fee_usdc >= entry fee
 * Eligibility (free tournament, entry fee 0):
 * - any user with a smart wallet and at least one agent — no tournament spending permission required
 * - one entry per user (tournament service enforces)
 */
export async function autoFillAgents(req, res) {
  try {
    const tournamentId = Number(req.params.id);
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return res.status(404).json({ success: false, message: "Tournament not found" });
    if (tournament.status !== "REGISTRATION_OPEN") {
      return res.status(400).json({ success: false, message: "Registration is closed" });
    }

    const chain = User.normalizeChain(tournament.chain);
    const entryFeeUnits = BigInt(tournament.entry_fee_wei ?? 0);
    const desired = Math.max(0, Math.min(Number(tournament.max_players || 32), Number(req.body?.desired_count ?? 32)));

    const rawPreferred = req.body?.user_agent_ids;
    let preferredAgentIds = Array.isArray(rawPreferred)
      ? [...new Set(rawPreferred.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))]
      : [];

    const vis = String(tournament.visibility || "OPEN").toUpperCase();
    /** @returns {Set<number>} */
    const allowedAgentIdSet = () => {
      let allowed = tournament.allowed_agent_ids;
      if (allowed == null) return new Set();
      if (typeof allowed === "string") {
        try {
          allowed = JSON.parse(allowed);
        } catch {
          return new Set();
        }
      }
      if (!Array.isArray(allowed)) return new Set();
      return new Set(allowed.map(Number).filter((n) => Number.isInteger(n) && n > 0));
    };

    // Invited-bot tournaments: if the client did not pass user_agent_ids, prefer everyone on the allowlist.
    if (preferredAgentIds.length === 0 && vis === "BOT_SELECTION") {
      const set = allowedAgentIdSet();
      if (set.size > 0) preferredAgentIds = [...set];
    }

    if (preferredAgentIds.length > 0 && Number(req.user?.id) !== Number(tournament.creator_id)) {
      return res.status(403).json({
        success: false,
        message: "Only the tournament creator can choose which agents to auto-fill",
      });
    }

    const currentCount = await db("tournament_entries").where({ tournament_id: tournamentId }).count("* as c").first();
    const alreadyCount = Number(currentCount?.c ?? 0);
    const remaining = Math.max(0, desired - alreadyCount);
    if (remaining <= 0) {
      return res.json({ success: true, added: 0, message: "Tournament already has enough entries" });
    }

    let perms = [];
    let candidates = [];

    if (entryFeeUnits > 0n) {
      perms = await db("agent_tournament_permissions")
        .where({ enabled: 1 })
        .andWhere((qb) => qb.whereNull("chain").orWhere("chain", chain))
        .select("user_id", "user_agent_id", "max_entry_fee_usdc", "daily_cap_usdc")
        .orderBy("updated_at", "desc");

      const permByUser = new Map();
      for (const p of perms || []) {
        const uid = Number(p.user_id);
        if (!permByUser.has(uid)) permByUser.set(uid, p);
      }
      candidates = Array.from(permByUser.values()).filter((p) => BigInt(p.max_entry_fee_usdc ?? "0") >= entryFeeUnits);
    } else {
      candidates = await listAgentSmartWalletCandidates();
    }

    if (preferredAgentIds.length > 0) {
      const allowSet = vis === "BOT_SELECTION" ? allowedAgentIdSet() : null;
      const agentRows = await db("user_agents").whereIn("id", preferredAgentIds).select("id", "user_id");
      const ownerByAgentId = new Map((agentRows || []).map((r) => [Number(r.id), Number(r.user_id)]));
      const creatorId = Number(tournament.creator_id);

      const isPreferredAgentAllowed = (agentId) => {
        if (!ownerByAgentId.has(agentId)) return false;
        if (vis === "BOT_SELECTION") {
          return allowSet.has(agentId);
        }
        return ownerByAgentId.get(agentId) === creatorId;
      };

      const preferredOrdered = [];

      if (entryFeeUnits > 0n) {
        const permByAgentId = new Map();
        for (const p of perms || []) {
          const aid = Number(p.user_agent_id);
          if (!permByAgentId.has(aid)) permByAgentId.set(aid, p);
        }
        for (const aid of preferredAgentIds) {
          if (!isPreferredAgentAllowed(aid)) continue;
          const ownerId = ownerByAgentId.get(aid);
          const p = permByAgentId.get(aid);
          if (!p || Number(p.user_id) !== ownerId) continue;
          if (BigInt(p.max_entry_fee_usdc ?? "0") < entryFeeUnits) continue;
          preferredOrdered.push(p);
        }
      } else {
        for (const aid of preferredAgentIds) {
          if (!isPreferredAgentAllowed(aid)) continue;
          const ownerId = ownerByAgentId.get(aid);
          preferredOrdered.push({
            user_id: ownerId,
            user_agent_id: aid,
            daily_cap_usdc: null,
            max_entry_fee_usdc: "0",
          });
        }
      }

      if (vis === "BOT_SELECTION" && preferredAgentIds.length > 0) {
        candidates = preferredOrdered;
      } else if (preferredAgentIds.length > 0) {
        const preferredOwnerIds = new Set(preferredOrdered.map((x) => Number(x.user_id)));
        const rest = candidates.filter((p) => !preferredOwnerIds.has(Number(p.user_id)));
        candidates = [...preferredOrdered, ...rest];
      }
    }

    let added = 0;
    const cfg = getChainConfig(chain);
    const escrow = cfg.tournamentEscrowAddress;
    const usdc = cfg.usdcAddress ?? process.env.CELO_USDC_ADDRESS ?? process.env.USDC_ADDRESS;

    const agentMultiEvent = vis === "BOT_SELECTION" || Boolean(Number(tournament.is_agent_only ?? 0));

    for (const p of candidates) {
      if (added >= remaining) break;
      try {
        const userId = Number(p.user_id);
        const fillAgentId = Number(p.user_agent_id);
        if (Number.isInteger(fillAgentId) && fillAgentId > 0) {
          if (await TournamentEntry.hasAgentEntry(tournamentId, fillAgentId)) continue;
        }
        if (!agentMultiEvent) {
          const exists = await db("tournament_entries").where({ tournament_id: tournamentId, user_id: userId }).first();
          if (exists) continue;
        }

        const user = await User.findById(userId);
        if (!user?.smart_wallet_address) continue;
        const smartWallet = String(user.smart_wallet_address).trim();
        if (!smartWallet) continue;

        let paymentTxHash = null;
        if (entryFeeUnits > 0n) {
          if (!escrow || !usdc) continue;
          if (p.daily_cap_usdc) {
            const cap = BigInt(p.daily_cap_usdc);
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const rows = await db("agent_tournament_spend_log")
              .where({ user_id: userId, user_agent_id: Number(p.user_agent_id), chain })
              .andWhere("created_at", ">=", start)
              .select("amount_usdc");
            let spent = 0n;
            for (const r of rows || []) {
              try { spent += BigInt(r.amount_usdc ?? "0"); } catch {}
            }
            if (spent + entryFeeUnits > cap) continue;
          }
          const nonce = BigInt("0x" + crypto.randomBytes(8).toString("hex"));
          const sig = await signWithdrawalAuthUsdc(smartWallet, usdc, escrow, entryFeeUnits, nonce, chain);
          const receipt = await withdrawFromSmartWalletUsdc(smartWallet, escrow, entryFeeUnits, nonce, sig, chain);
          paymentTxHash = receipt?.hash ?? null;
          await db("agent_tournament_spend_log").insert({
            user_id: userId,
            user_agent_id: Number(p.user_agent_id),
            tournament_id: tournamentId,
            chain,
            amount_usdc: entryFeeUnits.toString(),
            tx_hash: paymentTxHash,
            status: paymentTxHash ? "SUBMITTED" : "FAILED",
            error: paymentTxHash ? null : "No tx hash returned",
            created_at: db.fn.now(),
            updated_at: db.fn.now(),
          });
          if (!paymentTxHash) continue;
        }

        await tournamentService.registerPlayer(
          String(tournamentId),
          { userId, address: null, chain },
          paymentTxHash,
          {
            invite_token: tournament.invite_token,
            user_agent_id: Number(p.user_agent_id),
          }
        );

        added += 1;
      } catch (err) {
        // Keep going; best-effort fill.
        logger.warn({ err: err?.message, tournamentId }, "autoFillAgents: candidate failed");
      }
    }

    return res.json({ success: true, added });
  } catch (err) {
    logger.error({ err: err?.message }, "autoFillAgents failed");
    return res.status(500).json({ success: false, message: err?.message || "Auto-fill failed" });
  }
}

export async function getBracket(req, res) {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ success: false, message: "Tournament not found" });
    const rounds = await TournamentRound.findByTournament(req.params.id);
    const matches = await TournamentMatch.findByTournament(req.params.id);
    const entries = await TournamentEntry.findByTournament(req.params.id, { withUser: true });
    const entryMap = Object.fromEntries((entries || []).map((e) => [e.id, e]));
    const entryDisplayName = (e) =>
      (e?.agent_name && String(e.agent_name).trim()) || e?.username || e?.user_address || null;
    const gameIds = [...new Set((matches || []).map((m) => m.game_id).filter(Boolean))];
    let matchGameTypeById = {};
    let gameById = {};
    if (gameIds.length) {
      const gRows = await db("games").whereIn("id", gameIds).select("id", "game_type", "placements", "winner_id");
      matchGameTypeById = Object.fromEntries((gRows || []).map((r) => [r.id, r.game_type]));
      gameById = Object.fromEntries((gRows || []).map((r) => [r.id, r]));
    }
    const mapMatch = (m) => {
      let participant_entry_ids = null;
      try {
        const raw = m.participant_entry_ids;
        if (raw != null) {
          participant_entry_ids = typeof raw === "string" ? JSON.parse(raw) : raw;
        }
      } catch {
        participant_entry_ids = null;
      }
      const spec = m.spectator_token ? `/spectate/${m.spectator_token}` : null;
      const game = m.game_id ? gameById[m.game_id] : null;
      const standings = standingsForBracketMatch(m, game, entryMap, entryDisplayName);
      const runnerUp =
        standings && standings.length >= 2 ? standings.find((s) => s.place === 2)?.entry_id ?? null : null;
      return {
        id: m.id,
        match_index: m.match_index,
        slot_a_entry_id: m.slot_a_entry_id,
        slot_b_entry_id: m.slot_b_entry_id,
        participant_entry_ids,
        slot_a_type: m.slot_a_type,
        slot_b_type: m.slot_b_type,
        winner_entry_id: m.winner_entry_id,
        runner_up_entry_id: runnerUp,
        game_id: m.game_id,
        contract_game_id: m.contract_game_id,
        status: m.status,
        spectator_token: m.spectator_token ?? null,
        spectator_url: spec,
        slot_a_username: m.slot_a_entry_id ? entryDisplayName(entryMap[m.slot_a_entry_id]) : null,
        slot_b_username: m.slot_b_entry_id ? entryDisplayName(entryMap[m.slot_b_entry_id]) : null,
        winner_username: m.winner_entry_id ? entryDisplayName(entryMap[m.winner_entry_id]) : null,
        match_game_type: m.game_id ? matchGameTypeById[m.game_id] ?? null : null,
        standings,
        first_entry_id: standings?.[0]?.entry_id ?? null,
        second_entry_id: standings?.[1]?.entry_id ?? null,
        third_entry_id: standings?.[2]?.entry_id ?? null,
      };
    };
    const roundsPayload = rounds.map((r) => ({
      round_index: r.round_index,
      status: r.status,
      scheduled_start_at: r.scheduled_start_at ?? null,
      matches: matches.filter((m) => m.round_index === r.round_index).map(mapMatch),
    }));
    const round_results = roundsPayload.map((r) => ({
      round_index: r.round_index,
      status: r.status,
      matches: r.matches.map((mm) => ({
        match_id: mm.id,
        match_index: mm.match_index,
        status: mm.status,
        first_entry_id: mm.first_entry_id,
        second_entry_id: mm.second_entry_id,
        third_entry_id: mm.third_entry_id,
        standings: mm.standings,
      })),
    }));
    const bracket = {
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        format: tournament.format ?? null,
      },
      rounds: roundsPayload,
      round_results,
    };
    return res.json(bracket);
  } catch (err) {
    logger.error({ err: err?.message }, "tournament getBracket failed");
    return res.status(500).json({ success: false, message: err?.message || "Bracket failed" });
  }
}

export async function getLeaderboard(req, res) {
  try {
    const { phase = "live" } = req.query;
    const data = await tournamentService.getLeaderboard(req.params.id, phase);
    if (!data) return res.status(404).json({ success: false, message: "Tournament not found" });
    return res.json(data);
  } catch (err) {
    logger.error({ err: err?.message }, "tournament getLeaderboard failed");
    return res.status(500).json({ success: false, message: err?.message || "Leaderboard failed" });
  }
}

export async function closeRegistration(req, res) {
  try {
    const first_round_start_at = req.body?.first_round_start_at ?? null;
    const result = await tournamentService.generateBracket(req.params.id, { first_round_start_at });
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err?.message?.includes("not found")) return res.status(404).json({ success: false, message: err.message });
    if (err?.message?.includes("already closed")) return res.status(400).json({ success: false, message: err.message });
    if (err?.message?.includes("Need at least")) return res.status(400).json({ success: false, message: err.message });
    logger.error({ err: err?.message }, "tournament closeRegistration failed");
    return res.status(400).json({ success: false, message: err?.message || "Close registration failed" });
  }
}

export async function requestMatchStart(req, res) {
  try {
    const tournamentId = req.params.id;
    const matchId = req.params.matchId;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const preferredSymbol = req.body?.symbol ?? null;
    const result = await tournamentService.requestMatchStart(tournamentId, matchId, userId, preferredSymbol);
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err?.message?.includes("not found")) return res.status(404).json({ success: false, message: err.message });
    if (err?.message?.includes("not in this match")) return res.status(403).json({ success: false, message: err.message });
    if (err?.message?.includes("not opened") || err?.message?.includes("closed")) return res.status(400).json({ success: false, message: err.message });
    logger.error({ err: err?.message }, "tournament requestMatchStart failed");
    return res.status(400).json({ success: false, message: err?.message || "Start failed" });
  }
}

export async function createMatchGame(req, res) {
  try {
    const tournamentId = req.params.id;
    const matchId = req.params.matchId;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const result = await tournamentService.createMatchGameForCreator(tournamentId, matchId, userId);
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err?.message?.includes("not found")) return res.status(404).json({ success: false, message: err.message });
    if (err?.message?.includes("Only the tournament creator")) return res.status(403).json({ success: false, message: err.message });
    logger.error({ err: err?.message }, "tournament createMatchGame failed");
    return res.status(400).json({ success: false, message: err?.message || "Create game failed" });
  }
}

export async function startRound(req, res) {
  try {
    const roundIndex = Number(req.params.roundIndex);
    if (Number.isNaN(roundIndex) || roundIndex < 0) return res.status(400).json({ success: false, message: "Invalid round index" });
    const result = await tournamentService.startRound(req.params.id, roundIndex);
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err?.message?.includes("not found")) return res.status(404).json({ success: false, message: err.message });
    logger.error({ err: err?.message }, "tournament startRound failed");
    return res.status(400).json({ success: false, message: err?.message || "Start round failed" });
  }
}

export async function remove(req, res) {
  try {
    const tournament = req.tournament;
    if (!tournament) return res.status(404).json({ success: false, message: "Tournament not found" });
    await Tournament.delete(tournament.id);
    return res.json({ success: true, message: "Tournament deleted" });
  } catch (err) {
    logger.error({ err: err?.message }, "tournament delete failed");
    return res.status(500).json({ success: false, message: err?.message || "Delete failed" });
  }
}

/**
 * POST /api/tournaments/:id/admin-resolve
 * Contract-owner admin panel: complete tournament, set winner or draw, record payouts.
 * Secured with SHOP_ADMIN_SECRET (x-shop-admin-secret) when that env is set.
 */
export async function adminResolve(req, res) {
  try {
    const tournament = await Tournament.findByIdOrCode(req.params.id);
    if (!tournament) return res.status(404).json({ success: false, message: "Tournament not found" });
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const result = await tournamentService.adminResolveTournament(tournament.id, {
      mode: body.mode,
      winner_entry_id: body.winner_entry_id != null ? Number(body.winner_entry_id) : undefined,
      winner_user_id: body.winner_user_id != null ? Number(body.winner_user_id) : undefined,
      payouts_only: Boolean(body.payouts_only),
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err?.message?.includes("not found")) {
      return res.status(404).json({ success: false, message: err.message });
    }
    logger.error({ err: err?.message }, "tournament adminResolve failed");
    return res.status(400).json({ success: false, message: err?.message || "Admin resolve failed" });
  }
}

/**
 * GET /api/tournaments/payouts/pending
 * Get user's pending tournament payouts (requires auth).
 */
export async function getUserPendingPayouts(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { getUserPendingPayouts } = await import("../services/tournamentPayoutService.js");
    const payouts = await getUserPendingPayouts(userId);

    res.json({ payouts });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to fetch pending payouts");
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
}

/**
 * POST /api/tournaments/:id/claim-payout/:payoutId
 * Claim a pending payout and mark it as processed.
 */
export async function claimPayout(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { payoutId } = req.params;
    if (!payoutId) return res.status(400).json({ error: "payoutId required" });

    const { claimPayout } = await import("../services/tournamentPayoutService.js");
    const payout = await claimPayout(Number(payoutId), userId);

    res.json({
      message: "Payout claimed",
      payout,
    });
  } catch (err) {
    logger.error({ err: err?.message }, "Failed to claim payout");
    res.status(400).json({ error: err?.message || "Failed to claim payout" });
  }
}
