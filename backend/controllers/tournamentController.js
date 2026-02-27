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

export async function list(req, res) {
  try {
    const { status, chain, prize_source, limit = 50, offset = 0 } = req.query;
    const tournaments = await Tournament.findAll({ status, chain, prize_source, limit: Number(limit) || 50, offset: Number(offset) || 0 });
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
    return res.json({
      ...tournament,
      entries,
      rounds,
      matches,
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
    const { address, chain, payment_tx_hash } = req.body;
    const entry = await tournamentService.registerPlayer(tournamentId, { userId, address, chain }, payment_tx_hash);
    return res.status(201).json({ success: true, data: entry });
  } catch (err) {
    if (err?.message?.includes("Already registered") || err?.message?.includes("already registered")) return res.status(409).json({ success: false, message: err.message });
    if (err?.message?.includes("not found")) return res.status(404).json({ success: false, message: err.message });
    if (err?.message?.includes("Registration is closed") || err?.message?.includes("full")) return res.status(400).json({ success: false, message: err.message });
    logger.error({ err: err?.message }, "tournament register failed");
    return res.status(400).json({ success: false, message: err?.message || "Register failed" });
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
    const bracket = {
      tournament: { id: tournament.id, name: tournament.name, status: tournament.status },
      rounds: rounds.map((r) => ({
        round_index: r.round_index,
        status: r.status,
        scheduled_start_at: r.scheduled_start_at ?? null,
        matches: matches
          .filter((m) => m.round_index === r.round_index)
          .map((m) => ({
            id: m.id,
            match_index: m.match_index,
            slot_a_entry_id: m.slot_a_entry_id,
            slot_b_entry_id: m.slot_b_entry_id,
            slot_a_type: m.slot_a_type,
            slot_b_type: m.slot_b_type,
            winner_entry_id: m.winner_entry_id,
            game_id: m.game_id,
            contract_game_id: m.contract_game_id,
            status: m.status,
            slot_a_username: m.slot_a_entry_id ? entryMap[m.slot_a_entry_id]?.username : null,
            slot_b_username: m.slot_b_entry_id ? entryMap[m.slot_b_entry_id]?.username : null,
            winner_username: m.winner_entry_id ? entryMap[m.winner_entry_id]?.username : null,
          })),
      })),
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
    const result = await tournamentService.requestMatchStart(tournamentId, matchId, userId);
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err?.message?.includes("not found")) return res.status(404).json({ success: false, message: err.message });
    if (err?.message?.includes("not in this match")) return res.status(403).json({ success: false, message: err.message });
    if (err?.message?.includes("not opened") || err?.message?.includes("closed")) return res.status(400).json({ success: false, message: err.message });
    logger.error({ err: err?.message }, "tournament requestMatchStart failed");
    return res.status(400).json({ success: false, message: err?.message || "Start failed" });
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
